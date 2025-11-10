const { pool } = require('../../config/database');
const { redisHelper } = require('../../config/redis');
const AntiSpamService = require('./antiSpamService');
const HumanBehaviorService = require('./humanBehaviorService');
const {
    ensureProspectSchema,
    getPendingProspects,
    markInitialMessageSent,
    generateInitialMessage,
    incrementCampaignCounter
} = require('./prospectService');

class CampaignService {
    constructor(whatsappService, io) {
        this.whatsappService = whatsappService;
        this.io = io;
        this.antiSpam = new AntiSpamService();
        this.humanBehavior = new HumanBehaviorService(whatsappService);
        this.activeCampaigns = new Map();
    }

    // Crear nueva campaña
    async createCampaign(userId, campaignData) {
        try {
            const { 
                nombre, 
                descripcion, 
                tipo, 
                configuracion,
                fecha_agendada,
                horario_inicio,
                horario_fin,
                max_mensajes_dia,
                distribucion_automatica
            } = campaignData;

            // Determinar estado inicial
            const estadoInicial = fecha_agendada ? 'agendada' : 'borrador';

            const [result] = await pool.execute(
                `INSERT INTO campanas (
                    usuario_id, nombre, descripcion, tipo, configuracion, estado,
                    fecha_agendada, horario_inicio, horario_fin, max_mensajes_dia, distribucion_automatica
                 ) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId, 
                    nombre, 
                    descripcion || null, 
                    tipo, 
                    JSON.stringify(configuracion || {}),
                    estadoInicial,
                    fecha_agendada || null,
                    horario_inicio || '08:00:00',
                    horario_fin || '19:00:00',
                    max_mensajes_dia || 300,
                    distribucion_automatica !== false ? 1 : 0
                ]
            );

            console.log(`✅ Campaña creada: ID=${result.insertId}, Estado=${estadoInicial}${fecha_agendada ? ', Agendada para: ' + fecha_agendada : ''}`);

            return {
                success: true,
                campaignId: result.insertId
            };

        } catch (error) {
            console.error('Error creando campaña:', error);
            throw error;
        }
    }

    // Agregar mensajes a campaña
    async addMessagesToCampaign(campaignId, messages) {
        try {
            const values = messages.map(msg => [
                campaignId,
                msg.contacto_id,
                msg.dispositivo_id,
                msg.mensaje,
                msg.fecha_programado || null
            ]);

            await pool.query(
                `INSERT INTO mensajes (campana_id, contacto_id, dispositivo_id, mensaje, fecha_programado) 
                 VALUES ?`,
                [values]
            );

            // Actualizar total de mensajes en campaña
            await pool.execute(
                'UPDATE campanas SET total_mensajes = total_mensajes + ? WHERE id = ?',
                [messages.length, campaignId]
            );

            return { success: true, added: messages.length };

        } catch (error) {
            console.error('Error agregando mensajes:', error);
            throw error;
        }
    }

    // Iniciar campaña
    async startCampaign(campaignId) {
        try {
            // Verificar que no esté ya en ejecución
            if (this.activeCampaigns.has(campaignId)) {
                const existing = this.activeCampaigns.get(campaignId);
                // Si existe pero está pausada, reanudar en lugar de fallar
                if (existing && existing.paused) {
                    console.log(`🔄 startCampaign: Detectada campaña ${campaignId} pausada en memoria. Reanudando...`);
                    return await this.resumeCampaign(campaignId);
                }
                throw new Error('La campaña ya está en ejecución');
            }

            // Obtener campaña
            const [campaigns] = await pool.execute(
                'SELECT * FROM campanas WHERE id = ?',
                [campaignId]
            );

            if (campaigns.length === 0) {
                throw new Error('Campaña no encontrada');
            }

            const campaign = campaigns[0];

            await ensureProspectSchema();

            // Obtener prospectos pendientes o mensajes tradicionales
            const prospects = await getPendingProspects(campaignId);
            let messages = [];
            let devices = [];

            if (prospects.length > 0) {
                const deviceMap = new Map();

                prospects.forEach(prospect => {
                    if (prospect.dispositivo_estado !== 'conectado') {
                        console.warn(`⚠️ Dispositivo ${prospect.dispositivo_id} no está conectado. Prospecto ${prospect.id} omitido.`);
                        return;
                    }

                    deviceMap.set(prospect.dispositivo_id, {
                        id: prospect.dispositivo_id,
                        session_id: prospect.session_id,
                        nombre_dispositivo: prospect.nombre_dispositivo
                    });

                    messages.push({
                        id: `prospect-${prospect.id}`,
                        prospectId: prospect.id,
                        campana_id: prospect.campana_id,
                        telefono: prospect.telefono,
                        nombre: prospect.nombre,
                        categoria: prospect.categoria,
                        mensaje: prospect.mensaje_original,
                        dispositivo_id: prospect.dispositivo_id,
                        session_id: prospect.session_id,
                        metadata: prospect.metadata ? JSON.parse(prospect.metadata) : null,
                        isProspect: true
                    });
                });

                devices = Array.from(deviceMap.values());

                if (messages.length === 0) {
                    throw new Error('No hay prospectos disponibles para enviar (dispositivos desconectados)');
                }
            } else {
                // Obtener mensajes pendientes (incluir metadata para imágenes)
                const [dbMessages] = await pool.execute(
                    `SELECT m.*, c.telefono, c.nombre, d.session_id 
                     FROM mensajes m
                     JOIN contactos c ON m.contacto_id = c.id
                     JOIN dispositivos d ON m.dispositivo_id = d.id
                     WHERE m.campana_id = ? AND m.estado = 'pendiente'
                     ORDER BY m.id`,
                    [campaignId]
                );

                if (dbMessages.length === 0) {
                    throw new Error('No hay mensajes pendientes en esta campaña');
                }

                messages = dbMessages;

                // Obtener dispositivos únicos
                const deviceIds = [...new Set(dbMessages.map(m => m.dispositivo_id))];
                const [dbDevices] = await pool.execute(
                    `SELECT * FROM dispositivos WHERE id IN (${deviceIds.join(',')}) AND estado = 'conectado'`
                );

                if (dbDevices.length === 0) {
                    throw new Error('No hay dispositivos conectados para esta campaña');
                }

                devices = dbDevices;
            }

            // Actualizar estado de campaña
            await pool.execute(
                'UPDATE campanas SET estado = ?, fecha_inicio = NOW() WHERE id = ?',
                ['en_proceso', campaignId]
            );

            // Generar plan de envío con configuración de campaña
            const sendingPlan = this.antiSpam.generateSendingPlan(messages, devices, campaign);

            // Guardar en campaigns activas
            this.activeCampaigns.set(campaignId, {
                campaign,
                messages,
                devices,
                plan: sendingPlan,
                currentStep: 0,
                paused: false
            });

            // Ejecutar campaña de forma asíncrona
            this.executeCampaign(campaignId);

            return {
                success: true,
                campaignId,
                totalMessages: messages.length,
                devices: devices.length,
                estimatedTime: this.antiSpam.formatDuration(
                    sendingPlan.reduce((sum, step) => {
                        if (step.type === 'lot_pause') {
                            return sum + step.duration;
                        }
                        return sum + (step.pauseBefore || 0) + (step.pauseAfter || 0);
                    }, 0)
                )
            };

        } catch (error) {
            console.error('Error iniciando campaña:', error);
            throw error;
        }
    }

    // Ejecutar campaña
    async executeCampaign(campaignId, resumeFromStep = 0) {
        try {
            const campaignData = this.activeCampaigns.get(campaignId);
            if (!campaignData) return;

            const { plan, devices } = campaignData;
            
            // Tracking de fallos por dispositivo
            const deviceFailures = new Map();
            devices.forEach(d => deviceFailures.set(d.id, 0));
            const FAILURE_THRESHOLD = 3; // Máximo 3 fallos antes de redistribuir

            console.log(`🚀 Iniciando ejecución de campaña ${campaignId} con ${plan.length} pasos (desde paso ${resumeFromStep})`);

            for (let i = resumeFromStep; i < plan.length; i++) {
                // Verificar si la campaña fue pausada o cancelada
                if (campaignData.paused) {
                    console.log(`⏸️ Campaña ${campaignId} pausada en paso ${i}`);
                    // Guardar progreso en Redis
                    await this.saveCampaignProgress(campaignId, {
                        currentStep: i,
                        pausedAt: new Date().toISOString(),
                        totalSteps: plan.length
                    });
                    return;
                }

                const step = plan[i];
                campaignData.currentStep = i;

                // **PAUSA DE LOTE**
                if (step.type === 'lot_pause') {
                    console.log(`⏱️ Pausa de lote ${step.lotNumber}: ${Math.floor(step.duration / 1000)}s`);
                    
                    this.io.emit(`campaign-progress-${campaignId}`, {
                        type: 'lot_pause',
                        lotNumber: step.lotNumber,
                        duration: step.duration
                    });

                    // Durante pausa larga, ejecutar VARIOS comportamientos humanos
                    const randomDevice = devices[Math.floor(Math.random() * devices.length)];
                    if (randomDevice && randomDevice.session_id) {
                        const numBehaviors = Math.floor(Math.random() * 3) + 2; // 2-4 comportamientos
                        for (let b = 0; b < numBehaviors; b++) {
                            await this.humanBehavior.maybeExecuteBehavior(
                                randomDevice.session_id, 
                                randomDevice.id, 
                                0.9  // 90% probabilidad en pausas largas
                            );
                            await this.antiSpam.sleep(this.antiSpam.randomInRange(5000, 15000));
                        }
                    }

                    await this.antiSpam.sleep(step.duration);
                    continue;
                }

                // **COMPORTAMIENTO HUMANO**
                if (step.type === 'human_behavior') {
                    const device = devices.find(d => d.id === step.deviceId);
                    if (device && device.session_id) {
                        const repeatCount = step.repeatCount || 1;
                        const reason = step.reason || 'periodic';
                        console.log(`🤖 Ejecutando ${repeatCount} comportamiento(s) humano(s) en dispositivo ${step.deviceId} (${reason})`);
                        
                        for (let r = 0; r < repeatCount; r++) {
                            await this.humanBehavior.maybeExecuteBehavior(
                                device.session_id, 
                                device.id, 
                                step.probability || 0.8
                            );
                            
                            // Pausa entre comportamientos (si hay más de uno)
                            if (r < repeatCount - 1) {
                                await this.antiSpam.sleep(this.antiSpam.randomInRange(3000, 8000));
                            }
                        }
                    }
                    continue;
                }

                // **ENVIAR BATCH**
                if (step.type === 'send_batch' || step.messages) {
                    console.log(`📤 Paso ${step.stepNumber || i}: Dispositivo ${step.deviceId} enviará ${step.messages.length} mensaje(s)`);

                    // Pausa antes del batch
                    await this.antiSpam.sleep(step.pauseBefore);

                // Enviar cada mensaje
                for (const message of step.messages) {
                    try {
                        const sessionId = message.session_id;
                        const client = this.whatsappService.getClient(sessionId);

                        if (!client) {
                            throw new Error('Cliente no disponible');
                        }

                        // Flujo especial para prospectos
                        if (message.isProspect) {
                            try {
                                const result = await this.handleProspectInitialSend(message, campaignId);

                                this.io.emit(`campaign-progress-${campaignId}`, {
                                    type: 'prospect_initial_sent',
                                    prospectId: message.prospectId,
                                    telefono: message.telefono,
                                    initialMessage: result.initialMessage
                                });

                                console.log(`✓ Mensaje inicial enviado a prospecto ${message.telefono}`);
                            } catch (prospectError) {
                                console.error(`✗ Error enviando mensaje inicial a prospecto ${message.telefono}:`, prospectError);
                                await incrementCampaignCounter(campaignId, 'fallidos');
                            }

                            // Pequeña pausa entre prospectos para no saturar
                            await this.antiSpam.sleep(
                                this.antiSpam.randomInRange(500, 1200)
                            );
                            continue;
                        }

                        // Verificar si hay archivo adjunto
                        let metadata = null;
                        try {
                            if (message.metadata && typeof message.metadata === 'string') {
                                metadata = JSON.parse(message.metadata);
                            } else if (message.metadata) {
                                metadata = message.metadata;
                            }
                        } catch (e) {
                            console.log('Error parseando metadata:', e);
                        }

                        // 🤖 30% de probabilidad de conversar con Meta AI antes de enviar
                        if (Math.random() < 0.3 && client) {
                            console.log(`🤖 Conversando con Meta AI antes de enviar mensaje...`);
                            await this.whatsappService.chatWithMetaAI(client, sessionId);
                        }

                        // Enviar mensaje (con o sin imagen) CON HUMANIZACIÓN
                        if (metadata && metadata.hasFile && metadata.filePath) {
                            console.log(`📎 Enviando mensaje con imagen: ${metadata.filePath}`);
                            await this.whatsappService.sendMessageWithImage(
                                sessionId,
                                message.telefono,
                                message.mensaje,
                                metadata.filePath
                            );
                        } else {
                            await this.whatsappService.sendMessage(
                                sessionId,
                                message.telefono,
                                message.mensaje,
                                { humanize: true } // 🤖 ACTIVAR HUMANIZACIÓN
                            );
                        }

                        // Actualizar estado del mensaje
                        await pool.execute(
                            'UPDATE mensajes SET estado = ?, fecha_envio = NOW() WHERE id = ?',
                            ['enviado', message.id]
                        );

                        // Actualizar contador de campaña
                        await pool.execute(
                            'UPDATE campanas SET mensajes_enviados = mensajes_enviados + 1 WHERE id = ?',
                            [campaignId]
                        );

                        // Emitir progreso
                        this.io.emit(`campaign-progress-${campaignId}`, {
                            type: 'message_sent',
                            messageId: message.id,
                            contacto: message.telefono,
                            progress: Math.round((i / plan.length) * 100)
                        });

                        console.log(`✓ Mensaje enviado a ${message.telefono}`);

                        // Pequeña pausa entre mensajes dentro del batch
                        await this.antiSpam.sleep(
                            this.antiSpam.randomInRange(300, 800)
                        );

                    } catch (error) {
                        console.error(`✗ Error enviando mensaje ${message.id}:`, error);

                        // Marcar mensaje como fallido con detalles
                        const errorMsg = error?.message || error?.toString() || 'Error desconocido';
                        const observacion = this.determineErrorType(errorMsg);
                        
                        // Detectar si es número inválido
                        const numeroInvalido = observacion === 'numero_no_existe' ? 1 : 0;
                        
                        await pool.execute(
                            'UPDATE mensajes SET estado = ?, error_mensaje = ?, observacion = ?, numero_invalido = ? WHERE id = ?',
                            ['fallido', errorMsg, observacion, numeroInvalido, message.id]
                        );

                        await pool.execute(
                            'UPDATE campanas SET mensajes_fallidos = mensajes_fallidos + 1 WHERE id = ?',
                            [campaignId]
                        );

                        // Emitir evento de error para mostrar en frontend
                        this.io.emit(`campaign-error-message-${campaignId}`, {
                            messageId: message.id,
                            deviceId: step.deviceId,
                            telefono: message.telefono,
                            mensaje: message.mensaje,
                            observacion,
                            numeroInvalido: numeroInvalido === 1,
                            error: errorMsg
                        });

                        // Incrementar contador de fallos del dispositivo
                        const currentFailures = deviceFailures.get(step.deviceId) || 0;
                        deviceFailures.set(step.deviceId, currentFailures + 1);

                        // Si el dispositivo alcanza el umbral de fallos, redistribuir
                        if (currentFailures + 1 >= FAILURE_THRESHOLD) {
                            console.log(`⚠️ Dispositivo ${step.deviceId} alcanzó ${currentFailures + 1} fallos. Iniciando redistribución...`);
                            
                            await this.redistributeMessages(
                                campaignId, 
                                step.deviceId, 
                                devices.filter(d => d.id !== step.deviceId)
                            );
                            
                            // Resetear contador de fallos
                            deviceFailures.set(step.deviceId, 0);
                        }
                    }
                }

                    // Pausa después del batch
                    await this.antiSpam.sleep(step.pauseAfter);

                    // Comportamiento humano aleatorio después de cada batch
                    const deviceForBehavior = devices.find(d => d.id === step.deviceId);
                    if (deviceForBehavior) {
                        await this.humanBehavior.maybeExecuteBehavior(
                            deviceForBehavior.session_id, 
                            deviceForBehavior.id, 
                            0.7  // 70% probabilidad después de cada batch
                        );
                    }
                }
            }

            // Campaña completada
            await pool.execute(
                'UPDATE campanas SET estado = ?, fecha_fin = NOW() WHERE id = ?',
                ['completada', campaignId]
            );

            this.activeCampaigns.delete(campaignId);

            this.io.emit(`campaign-completed-${campaignId}`, {
                campaignId,
                completedAt: new Date().toISOString()
            });

            console.log(`✅ Campaña ${campaignId} completada exitosamente`);

        } catch (error) {
            console.error(`Error ejecutando campaña ${campaignId}:`, error);

            await pool.execute(
                'UPDATE campanas SET estado = ? WHERE id = ?',
                ['cancelada', campaignId]
            );

            this.activeCampaigns.delete(campaignId);

            this.io.emit(`campaign-error-${campaignId}`, {
                campaignId,
                error: error.message
            });
        }
    }

    // Pausar campaña
    async pauseCampaign(campaignId) {
        const campaignData = this.activeCampaigns.get(campaignId);
        if (!campaignData) {
            throw new Error('Campaña no encontrada o no está en ejecución');
        }
        
        console.log(`⏸️ Pausando campaña ${campaignId}...`);
        campaignData.paused = true;
        
        // Actualizar estado en BD
        await pool.execute(
            'UPDATE campanas SET estado = ? WHERE id = ?',
            ['pausada', campaignId]
        );
        
        // Guardar progreso actual en Redis
        await this.saveCampaignProgress(campaignId, {
            currentStep: campaignData.currentStep,
            pausedAt: new Date().toISOString(),
            totalSteps: campaignData.plan.length,
            plan: campaignData.plan,
            devices: campaignData.devices
        });
        
        this.io.emit(`campaign-paused-${campaignId}`, {
            campaignId,
            currentStep: campaignData.currentStep,
            totalSteps: campaignData.plan.length,
            pausedAt: new Date().toISOString()
        });
        
        console.log(`✅ Campaña ${campaignId} pausada exitosamente en paso ${campaignData.currentStep}`);
        
        return { 
            success: true, 
            currentStep: campaignData.currentStep,
            totalSteps: campaignData.plan.length
        };
    }

    // Reanudar campaña
    async resumeCampaign(campaignId) {
        try {
            // Siempre intentar leer progreso más reciente de Redis
            const savedProgress = await this.getCampaignProgress(campaignId);

            // Verificar si ya está en memoria
            let campaignData = this.activeCampaigns.get(campaignId);
            let resumeFromStep = 0;
            
            // Si no está en memoria, intentar recuperar desde Redis
            if (!campaignData) {
                console.log(`🔄 Recuperando campaña pausada ${campaignId} desde Redis...`);
                
                if (!savedProgress) {
                    // Si no hay progreso guardado, iniciar desde cero
                    console.log(`⚠️ No se encontró progreso guardado, iniciando campaña desde el principio`);
                    return await this.startCampaign(campaignId);
                }
                
                // Recuperar datos de la campaña
                const [campaigns] = await pool.execute(
                    'SELECT * FROM campanas WHERE id = ?',
                    [campaignId]
                );
                
                if (campaigns.length === 0) {
                    throw new Error('Campaña no encontrada');
                }
                
                const campaign = campaigns[0];
                
                // Recrear campaignData desde el progreso guardado
                campaignData = {
                    campaign,
                    plan: savedProgress.plan,
                    devices: savedProgress.devices,
                    currentStep: savedProgress.currentStep || 0,
                    paused: false
                };
                
                this.activeCampaigns.set(campaignId, campaignData);
                resumeFromStep = savedProgress.currentStep || 0;
                
                console.log(`✅ Campaña recuperada, reanudando desde paso ${resumeFromStep}`);
            } else {
                // Si está en memoria, preferir el progreso guardado si existe
                if (savedProgress && typeof savedProgress.currentStep === 'number') {
                    resumeFromStep = savedProgress.currentStep;
                    campaignData.plan = savedProgress.plan || campaignData.plan;
                    campaignData.devices = savedProgress.devices || campaignData.devices;
                } else {
                    resumeFromStep = campaignData.currentStep || 0;
                }
                console.log(`🔄 Reanudando campaña ${campaignId} desde paso ${resumeFromStep}`);
            }
            
            // Actualizar estado en BD
            await pool.execute(
                'UPDATE campanas SET estado = ? WHERE id = ?',
                ['en_proceso', campaignId]
            );
            
            // Desmarcar paused
            campaignData.paused = false;
            
            // Emitir evento
            this.io.emit(`campaign-resumed-${campaignId}`, {
                campaignId,
                resumingFrom: resumeFromStep,
                totalSteps: campaignData.plan.length
            });
            
            // Continuar ejecución desde donde se quedó
            this.executeCampaign(campaignId, resumeFromStep);
            
            return { 
                success: true,
                resumedFrom: resumeFromStep,
                totalSteps: campaignData.plan.length
            };
            
        } catch (error) {
            console.error('Error reanudando campaña:', error);
            throw error;
        }
    }

    // Guardar progreso de campaña en Redis
    async saveCampaignProgress(campaignId, progress) {
        try {
            await redisHelper.setCache(
                `campaign:progress:${campaignId}`,
                progress,
                86400 // 24 horas
            );
            console.log(`💾 Progreso de campaña ${campaignId} guardado en Redis`);
        } catch (error) {
            console.error('Error guardando progreso:', error);
        }
    }

    // Obtener progreso de campaña desde Redis
    async getCampaignProgress(campaignId) {
        try {
            const progress = await redisHelper.getCache(`campaign:progress:${campaignId}`);
            return progress;
        } catch (error) {
            console.error('Error obteniendo progreso:', error);
            return null;
        }
    }

    // Cancelar campaña
    async cancelCampaign(campaignId) {
        const campaignData = this.activeCampaigns.get(campaignId);
        if (campaignData) {
            this.activeCampaigns.delete(campaignId);
        }
        
        await pool.execute(
            'UPDATE campanas SET estado = ?, fecha_fin = NOW() WHERE id = ?',
            ['cancelada', campaignId]
        );

        return { success: true };
    }

    // Obtener campañas de usuario
    async getUserCampaigns(userId) {
        try {
            const [campaigns] = await pool.execute(
                `SELECT c.*, 
                 (SELECT COUNT(*) FROM mensajes WHERE campana_id = c.id) as total_mensajes_real
                 FROM campanas c
                 WHERE c.usuario_id = ?
                 ORDER BY c.fecha_creacion DESC`,
                [userId]
            );

            return campaigns;

        } catch (error) {
            console.error('Error obteniendo campañas:', error);
            throw error;
        }
    }

    // Obtener estado de campaña
    async getCampaignStatus(campaignId) {
        try {
            const [campaigns] = await pool.execute(
                'SELECT * FROM campanas WHERE id = ?',
                [campaignId]
            );

            if (campaigns.length === 0) {
                throw new Error('Campaña no encontrada');
            }

            const campaign = campaigns[0];
            const isActive = this.activeCampaigns.has(campaignId);

            return {
                ...campaign,
                isActive,
                currentStep: isActive ? this.activeCampaigns.get(campaignId).currentStep : null
            };

        } catch (error) {
            console.error('Error obteniendo estado de campaña:', error);
            throw error;
        }
    }

    // Obtener errores de una campaña
    async getCampaignErrors(campaignId) {
        try {
            const [errors] = await pool.execute(
                `SELECT m.id, m.mensaje, m.error_mensaje, m.observacion, m.fecha_envio,
                 c.telefono, c.nombre, d.id as dispositivo_id, d.nombre_dispositivo
                 FROM mensajes m
                 JOIN contactos c ON m.contacto_id = c.id
                 JOIN dispositivos d ON m.dispositivo_id = d.id
                 WHERE m.campana_id = ? AND m.estado = 'fallido'
                 ORDER BY m.fecha_envio DESC`,
                [campaignId]
            );

            return errors;

        } catch (error) {
            console.error('Error obteniendo errores de campaña:', error);
            throw error;
        }
    }

    // Determinar tipo de error basado en el mensaje
    determineErrorType(errorMessage) {
        const errorLower = errorMessage.toLowerCase();
        
        if (errorLower.includes('not registered') || errorLower.includes('no registrado') || 
            errorLower.includes('invalid number') || errorLower.includes('número inválido')) {
            return 'Número inexistente o no tiene WhatsApp';
        } else if (errorLower.includes('blocked') || errorLower.includes('bloqueado')) {
            return 'Número bloqueado';
        } else if (errorLower.includes('timeout') || errorLower.includes('time out')) {
            return 'Tiempo de espera agotado';
        } else if (errorLower.includes('disconnected') || errorLower.includes('desconectado')) {
            return 'Dispositivo desconectado';
        } else if (errorLower.includes('rate limit') || errorLower.includes('spam')) {
            return 'Límite de envío alcanzado (SPAM)';
        } else if (errorLower.includes('network') || errorLower.includes('red')) {
            return 'Error de conexión de red';
        } else {
            return 'Error desconocido';
        }
    }

    // Redistribuir mensajes pendientes cuando un dispositivo falla
    async redistributeMessages(campaignId, failedDeviceId, activeDevices) {
        try {
            console.log(`🔄 Redistribuyendo mensajes del dispositivo ${failedDeviceId}...`);

            if (activeDevices.length === 0) {
                console.error('❌ No hay dispositivos activos para redistribuir');
                return;
            }

            // Obtener mensajes pendientes del dispositivo fallido
            const [pendingMessages] = await pool.execute(
                `SELECT id FROM mensajes 
                 WHERE campana_id = ? AND dispositivo_id = ? AND estado = 'pendiente'`,
                [campaignId, failedDeviceId]
            );

            if (pendingMessages.length === 0) {
                console.log('✓ No hay mensajes pendientes para redistribuir');
                return;
            }

            console.log(`   📊 ${pendingMessages.length} mensajes a redistribuir entre ${activeDevices.length} dispositivos`);

            // Redistribuir equitativamente
            let deviceIndex = 0;
            for (const message of pendingMessages) {
                const newDevice = activeDevices[deviceIndex];
                
                await pool.execute(
                    'UPDATE mensajes SET dispositivo_id = ? WHERE id = ?',
                    [newDevice.id, message.id]
                );

                deviceIndex = (deviceIndex + 1) % activeDevices.length;
            }

            // Calcular nueva distribución
            const [newDistribution] = await pool.execute(
                `SELECT d.id, d.nombre_dispositivo, COUNT(*) as total 
                 FROM mensajes m 
                 JOIN dispositivos d ON m.dispositivo_id = d.id 
                 WHERE m.campana_id = ? AND m.estado = 'pendiente'
                 GROUP BY d.id`,
                [campaignId]
            );

            console.log(`   ✅ Redistribución completada. Nueva distribución:`);
            newDistribution.forEach(d => {
                console.log(`      📱 Dispositivo ${d.id} (${d.nombre_dispositivo}): ${d.total} mensajes`);
            });

            // 🔥 NUEVO: Ajustar parámetros anti-spam para ser MÁS CONSERVADORES
            console.log(`   ⚙️ Ajustando parámetros anti-spam (pausas más largas)...`);
            this.antiSpam.config.minPauseBetweenMessages = Math.min(
                this.antiSpam.config.minPauseBetweenMessages * 1.5, 
                120000 // Máximo 2 minutos
            );
            this.antiSpam.config.maxPauseBetweenMessages = Math.min(
                this.antiSpam.config.maxPauseBetweenMessages * 1.5, 
                180000 // Máximo 3 minutos
            );
            this.antiSpam.config.longPauseProbability = Math.min(
                this.antiSpam.config.longPauseProbability + 0.1, 
                0.5 // Máximo 50% de pausas largas
            );

            console.log(`      🕐 Nuevas pausas: ${this.antiSpam.config.minPauseBetweenMessages/1000}s - ${this.antiSpam.config.maxPauseBetweenMessages/1000}s`);
            console.log(`      ⏰ Probabilidad pausas largas: ${this.antiSpam.config.longPauseProbability * 100}%`);

                // 🔥 NUEVO: Regenerar plan de envío con nueva distribución
            const campaignData = this.activeCampaigns.get(campaignId);
            if (campaignData) {
                console.log(`   🔄 Regenerando plan de envío...`);
                
                // Obtener configuración de campaña
                const [campaignConfig] = await pool.execute(
                    'SELECT * FROM campanas WHERE id = ?',
                    [campaignId]
                );
                
                // Obtener TODOS los mensajes pendientes con nueva distribución
                const [allPendingMessages] = await pool.execute(
                    `SELECT m.*, c.telefono, c.nombre, d.session_id 
                     FROM mensajes m
                     JOIN contactos c ON m.contacto_id = c.id
                     JOIN dispositivos d ON m.dispositivo_id = d.id
                     WHERE m.campana_id = ? AND m.estado = 'pendiente'
                     ORDER BY m.id`,
                    [campaignId]
                );

                // Generar nuevo plan con menos dispositivos
                const newPlan = this.antiSpam.generateSendingPlan(
                    allPendingMessages,
                    activeDevices,
                    campaignConfig[0]
                );

                // Actualizar el plan en el Map
                campaignData.plan = newPlan;
                campaignData.currentStep = 0; // Reiniciar desde el principio del nuevo plan
                
                console.log(`   ✅ Nuevo plan generado: ${newPlan.length} pasos`);
            }

            // Emitir evento de redistribución
            this.io.emit(`campaign-redistributed-${campaignId}`, {
                failedDeviceId,
                redistributedCount: pendingMessages.length,
                newDistribution,
                adjustedAntiSpam: {
                    minPause: this.antiSpam.config.minPauseBetweenMessages,
                    maxPause: this.antiSpam.config.maxPauseBetweenMessages,
                    longPauseProbability: this.antiSpam.config.longPauseProbability
                }
            });

        } catch (error) {
            console.error('Error en redistribución:', error);
        }
    }

    // 🔥 NUEVO: Detectar dispositivo nuevo y redistribuir mensajes pendientes de campañas activas
    async handleNewDeviceConnected(deviceId) {
        try {
            console.log(`\n🆕 === DISPOSITIVO NUEVO CONECTADO: ${deviceId} ===`);
            
            // Obtener información del dispositivo
            const [devices] = await pool.execute(
                'SELECT * FROM dispositivos WHERE id = ? AND estado = ?',
                [deviceId, 'conectado']
            );

            if (devices.length === 0) {
                console.log('   ⚠️ Dispositivo no encontrado o no está conectado');
                return;
            }

            const newDevice = devices[0];

            // Buscar todas las campañas activas (en_proceso)
            const [activeCampaigns] = await pool.execute(
                `SELECT DISTINCT c.id, c.nombre, c.usuario_id
                 FROM campanas c
                 INNER JOIN mensajes m ON c.id = m.campana_id
                 WHERE c.estado = 'en_proceso' AND m.estado = 'pendiente'
                 GROUP BY c.id`,
                []
            );

            if (activeCampaigns.length === 0) {
                console.log('   ℹ️ No hay campañas activas para redistribuir');
                return;
            }

            console.log(`   📊 Encontradas ${activeCampaigns.length} campaña(s) activa(s)`);

            // Para cada campaña activa, redistribuir mensajes pendientes
            for (const campaign of activeCampaigns) {
                console.log(`\n   🔄 Procesando campaña: ${campaign.nombre} (ID: ${campaign.id})`);

                // Obtener categoría de la campaña (si existe)
                const [campaignMessages] = await pool.execute(
                    `SELECT DISTINCT c.categoria_id 
                     FROM mensajes m
                     JOIN contactos c ON m.contacto_id = c.id
                     WHERE m.campana_id = ? AND m.estado = 'pendiente'
                     LIMIT 1`,
                    [campaign.id]
                );

                // Obtener TODOS los dispositivos conectados de la misma categoría (o todos si no hay categoría)
                let connectedDevices;
                if (campaignMessages.length > 0 && campaignMessages[0].categoria_id) {
                    const categoriaId = campaignMessages[0].categoria_id;
                    console.log(`   📁 Categoría encontrada: ${categoriaId}`);
                    
                    // Obtener dispositivos conectados que pertenecen a esta categoría
                    const [devicesByCategory] = await pool.execute(
                        `SELECT DISTINCT d.* 
                         FROM dispositivos d
                         JOIN categoria_dispositivo cd ON d.id = cd.dispositivo_id
                         WHERE cd.categoria_id = ? AND d.estado = 'conectado'`,
                        [categoriaId]
                    );

                    // Si no hay dispositivos por categoría, usar todos los conectados
                    if (devicesByCategory.length > 0) {
                        connectedDevices = devicesByCategory;
                    } else {
                        // Todos los dispositivos conectados (puede haber una sola categoría para todos)
                        const [allConnected] = await pool.execute(
                            'SELECT * FROM dispositivos WHERE estado = ? AND usuario_id = ?',
                            ['conectado', campaign.usuario_id]
                        );
                        connectedDevices = allConnected;
                    }
                } else {
                    // Sin categoría específica, usar todos los dispositivos conectados del usuario
                    const [allConnected] = await pool.execute(
                        'SELECT * FROM dispositivos WHERE estado = ? AND usuario_id = ?',
                        ['conectado', campaign.usuario_id]
                    );
                    connectedDevices = allConnected;
                }

                // Asegurar que el nuevo dispositivo esté incluido
                if (!connectedDevices.find(d => d.id === deviceId)) {
                    connectedDevices.push(newDevice);
                }

                console.log(`   📱 Dispositivos conectados disponibles: ${connectedDevices.length}`);

                if (connectedDevices.length === 0) {
                    console.log('   ⚠️ No hay dispositivos conectados para esta campaña');
                    continue;
                }

                // Obtener TODOS los mensajes pendientes de esta campaña
                const [allPendingMessages] = await pool.execute(
                    `SELECT m.id, m.dispositivo_id, m.campana_id
                     FROM mensajes m
                     WHERE m.campana_id = ? AND m.estado = 'pendiente'`,
                    [campaign.id]
                );

                if (allPendingMessages.length === 0) {
                    console.log('   ℹ️ No hay mensajes pendientes en esta campaña');
                    continue;
                }

                console.log(`   📨 Mensajes pendientes: ${allPendingMessages.length}`);

                // Redistribuir TODOS los mensajes pendientes equitativamente entre TODOS los dispositivos conectados
                // Esto incluye el nuevo dispositivo
                let deviceIndex = 0;
                let redistributedCount = 0;

                for (const message of allPendingMessages) {
                    const targetDevice = connectedDevices[deviceIndex];
                    
                    await pool.execute(
                        'UPDATE mensajes SET dispositivo_id = ? WHERE id = ?',
                        [targetDevice.id, message.id]
                    );

                    deviceIndex = (deviceIndex + 1) % connectedDevices.length;
                    redistributedCount++;
                }

                console.log(`   ✅ Redistribución completada: ${redistributedCount} mensajes redistribuidos equitativamente`);

                // Mostrar distribución final
                const [finalDistribution] = await pool.execute(
                    `SELECT d.id, d.nombre_dispositivo, COUNT(*) as total 
                     FROM mensajes m 
                     JOIN dispositivos d ON m.dispositivo_id = d.id 
                     WHERE m.campana_id = ? AND m.estado = 'pendiente'
                     GROUP BY d.id`,
                    [campaign.id]
                );

                console.log(`   📊 Distribución final:`);
                finalDistribution.forEach(d => {
                    const percentage = ((d.total / allPendingMessages.length) * 100).toFixed(1);
                    const isNew = d.id === deviceId ? ' 🆕' : '';
                    console.log(`      📱 Dispositivo ${d.id} (${d.nombre_dispositivo}): ${d.total} mensajes (${percentage}%)${isNew}`);
                });

                // Si la campaña está en ejecución, regenerar el plan de envío
                const campaignData = this.activeCampaigns.get(campaign.id);
                if (campaignData) {
                    console.log(`   🔄 Regenerando plan de envío con ${connectedDevices.length} dispositivo(s)...`);
                    
                    // Obtener mensajes con metadata completa
                    const [messagesWithMetadata] = await pool.execute(
                        `SELECT m.*, c.telefono, c.nombre, d.session_id 
                         FROM mensajes m
                         JOIN contactos c ON m.contacto_id = c.id
                         JOIN dispositivos d ON m.dispositivo_id = d.id
                         WHERE m.campana_id = ? AND m.estado = 'pendiente'
                         ORDER BY m.id`,
                        [campaign.id]
                    );

                    // Obtener configuración de campaña
                    const [campaignConfig] = await pool.execute(
                        'SELECT * FROM campanas WHERE id = ?',
                        [campaign.id]
                    );

                    // Generar nuevo plan con todos los dispositivos disponibles
                    const newPlan = this.antiSpam.generateSendingPlan(
                        messagesWithMetadata,
                        connectedDevices,
                        campaignConfig[0]
                    );

                    // Actualizar el plan y los dispositivos en el Map
                    campaignData.plan = newPlan;
                    campaignData.devices = connectedDevices;
                    campaignData.currentStep = campaignData.currentStep || 0; // No reiniciar, continuar desde donde iba
                    
                    console.log(`   ✅ Nuevo plan generado: ${newPlan.length} pasos (continúa desde paso ${campaignData.currentStep})`);

                    // Emitir evento
                    this.io.emit(`campaign-device-added-${campaign.id}`, {
                        newDeviceId: deviceId,
                        newDeviceName: newDevice.nombre_dispositivo,
                        totalDevices: connectedDevices.length,
                        redistributedCount,
                        finalDistribution,
                        message: `Dispositivo nuevo "${newDevice.nombre_dispositivo}" agregado. ${redistributedCount} mensajes redistribuidos equitativamente.`
                    });
                } else {
                    // Campaña no está en ejecución en memoria, solo guardar la redistribución
                    console.log(`   ℹ️ Campaña no está en ejecución en memoria, redistribución guardada en BD`);
                }
            }

            console.log(`\n✅ === FIN PROCESAMIENTO DISPOSITIVO NUEVO ===\n`);

        } catch (error) {
            console.error('❌ Error procesando dispositivo nuevo:', error);
            console.error(error.stack);
        }
    }

    // Método para manejar el envío inicial de un prospecto
    async handleProspectInitialSend(message, campaignId) {
        try {
            const sessionId = message.session_id;
            const client = this.whatsappService.getClient(sessionId);

            if (!client) {
                throw new Error('Cliente no disponible para enviar mensaje inicial');
            }

            const initialMessage = generateInitialMessage(message.nombre, message.categoria);
            const acceptButtonId = `prospect:${message.prospectId}:accept`;
            const rejectButtonId = `prospect:${message.prospectId}:reject`;

            const sendResult = await this.whatsappService.sendButtonMessage(
                sessionId,
                message.telefono,
                initialMessage,
                [
                    { id: acceptButtonId, text: 'ACEPTAR' },
                    { id: rejectButtonId, text: 'RECHAZAR' }
                ],
                'Selecciona una opción',
                { displayName: message.nombre }
            );

            await markInitialMessageSent(message.prospectId, {
                initialMessage,
                acceptButtonId,
                rejectButtonId,
                messageKey: sendResult?.messageId || null
            });

            await incrementCampaignCounter(campaignId, 'enviados');

            return {
                initialMessage,
                acceptButtonId,
                rejectButtonId,
                messageId: sendResult?.messageId || null
            };

        } catch (error) {
            console.error(`✗ Error enviando mensaje inicial a prospecto ${message.telefono}:`, error);
            throw error;
        }
    }
}

module.exports = CampaignService;
