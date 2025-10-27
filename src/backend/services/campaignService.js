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

            // Obtener mensajes pendientes
            const [messages] = await pool.execute(
                `SELECT m.*, c.telefono, d.session_id 
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

            console.log(`🚀 Iniciando ejecución de campaña ${campaignId} con ${plan.length} pasos`);

            for (let i = 0; i < plan.length; i++) {
                // Verificar si la campaña fue pausada o cancelada
                if (campaignData.paused) {
                    console.log(`⏸️ Campaña ${campaignId} pausada`);
                    break;
                }

                const step = plan[i];
                campaignData.currentStep = i;

                if (step.type === 'lot_pause') {
                    // Pausa entre lotes
                    console.log(`⏱️ Pausa de lote ${step.lotNumber}: ${step.duration}ms`);
                    
                    // Emitir progreso
                    this.io.emit(`campaign-progress-${campaignId}`, {
                        type: 'lot_pause',
                        lotNumber: step.lotNumber,
                        duration: step.duration
                    });

                    // Durante la pausa, ejecutar comportamiento humano (probabilidad alta)
                    const deviceId = devices[Math.floor(Math.random() * devices.length)].id;
                    const sessionId = devices.find(d => d.id === deviceId)?.session_id;
                    
                    if (sessionId) {
                        // Ejecutar múltiples comportamientos durante pausa larga
                        const numBehaviors = Math.floor(Math.random() * 3) + 1; // 1-3 comportamientos
                        for (let b = 0; b < numBehaviors; b++) {
                            await this.humanBehavior.maybeExecuteBehavior(sessionId, deviceId, 0.8); // 80% probabilidad
                            await this.antiSpam.sleep(this.antiSpam.randomInRange(3000, 8000));
                        }
                    }

                    await this.antiSpam.sleep(step.duration);
                    continue;
                }

                // Enviar batch de mensajes
                console.log(`📤 Enviando batch de ${step.messages.length} mensajes desde dispositivo ${step.deviceId}`);

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

                        // Enviar mensaje
                        await this.whatsappService.sendMessage(
                            sessionId,
                            message.telefono,
                            message.mensaje
                        );

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

                        // Marcar mensaje como fallido
                        await pool.execute(
                            'UPDATE mensajes SET estado = ?, error_mensaje = ? WHERE id = ?',
                            ['fallido', error.message, message.id]
                        );

                        await pool.execute(
                            'UPDATE campanas SET mensajes_fallidos = mensajes_fallidos + 1 WHERE id = ?',
                            [campaignId]
                        );
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
                        0.6  // 60% probabilidad después de cada batch (aumentado)
                    );
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
}

module.exports = CampaignService;

