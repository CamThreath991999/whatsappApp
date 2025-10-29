const { pool } = require('../../config/database');
const { redisHelper } = require('../../config/redis');
const AntiSpamService = require('./antiSpamService');
const HumanBehaviorService = require('./humanBehaviorService');

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
            const { nombre, descripcion, tipo, configuracion } = campaignData;

            const [result] = await pool.execute(
                `INSERT INTO campanas (usuario_id, nombre, descripcion, tipo, configuracion, estado) 
                 VALUES (?, ?, ?, ?, ?, 'borrador')`,
                [userId, nombre, descripcion || null, tipo, JSON.stringify(configuracion || {})]
            );

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

            // Obtener mensajes pendientes (incluir metadata para imágenes)
            const [messages] = await pool.execute(
                `SELECT m.*, c.telefono, c.nombre, d.session_id 
                 FROM mensajes m
                 JOIN contactos c ON m.contacto_id = c.id
                 JOIN dispositivos d ON m.dispositivo_id = d.id
                 WHERE m.campana_id = ? AND m.estado = 'pendiente'
                 ORDER BY m.id`,
                [campaignId]
            );

            if (messages.length === 0) {
                throw new Error('No hay mensajes pendientes en esta campaña');
            }

            // Obtener dispositivos únicos
            const deviceIds = [...new Set(messages.map(m => m.dispositivo_id))];
            const [devices] = await pool.execute(
                `SELECT * FROM dispositivos WHERE id IN (${deviceIds.join(',')}) AND estado = 'conectado'`
            );

            if (devices.length === 0) {
                throw new Error('No hay dispositivos conectados para esta campaña');
            }

            // Actualizar estado de campaña
            await pool.execute(
                'UPDATE campanas SET estado = ?, fecha_inicio = NOW() WHERE id = ?',
                ['en_proceso', campaignId]
            );

            // Generar plan de envío
            const sendingPlan = this.antiSpam.generateSendingPlan(messages, devices);

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
    async executeCampaign(campaignId) {
        try {
            const campaignData = this.activeCampaigns.get(campaignId);
            if (!campaignData) return;

            const { plan, devices } = campaignData;
            
            // Tracking de fallos por dispositivo
            const deviceFailures = new Map();
            devices.forEach(d => deviceFailures.set(d.id, 0));
            const FAILURE_THRESHOLD = 3; // Máximo 3 fallos antes de redistribuir

            console.log(`🚀 Iniciando ejecución de campaña ${campaignId} con ${plan.length} pasos`);

            for (let i = 0; i < plan.length; i++) {
                // Verificar si la campaña fue pausada o cancelada
                if (campaignData.paused) {
                    console.log(`⏸️ Campaña ${campaignId} pausada`);
                    break;
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

                        // Verificar si hay archivo adjunto
                        let metadata = null;
                        try {
                            metadata = message.metadata ? JSON.parse(message.metadata) : null;
                        } catch (e) {
                            console.log('Error parseando metadata:', e);
                        }

                        // Enviar mensaje (con o sin imagen)
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
                                message.mensaje
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
                        
                        await pool.execute(
                            'UPDATE mensajes SET estado = ?, error_mensaje = ?, observacion = ? WHERE id = ?',
                            ['fallido', errorMsg, observacion, message.id]
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
        if (campaignData) {
            campaignData.paused = true;
            await pool.execute(
                'UPDATE campanas SET estado = ? WHERE id = ?',
                ['pausada', campaignId]
            );
            return { success: true };
        }
        throw new Error('Campaña no encontrada o no está en ejecución');
    }

    // Reanudar campaña
    async resumeCampaign(campaignId) {
        const campaignData = this.activeCampaigns.get(campaignId);
        if (campaignData) {
            campaignData.paused = false;
            await pool.execute(
                'UPDATE campanas SET estado = ? WHERE id = ?',
                ['en_proceso', campaignId]
            );
            this.executeCampaign(campaignId);
            return { success: true };
        }
        throw new Error('Campaña no encontrada');
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

            // Emitir evento de redistribución
            this.io.emit(`campaign-redistributed-${campaignId}`, {
                failedDeviceId,
                redistributedCount: pendingMessages.length,
                newDistribution
            });

        } catch (error) {
            console.error('Error en redistribución:', error);
        }
    }
}

module.exports = CampaignService;
