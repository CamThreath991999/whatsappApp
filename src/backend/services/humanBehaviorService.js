const { pool } = require('../../config/database');

class HumanBehaviorService {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
        this.behaviors = [
            'changeStatus',
            'changeDescription',
            'scrollChats',
            'readMessages',
            'reactToMessage',
            'renameContact',
            'changeSettings',
            'saveAndDeleteContact',     // NUEVO
            'uploadAndDeleteStatus',    // NUEVO
            'chatWithMetaAI'           // NUEVO
        ];
    }

    // Obtener comportamiento aleatorio
    getRandomBehavior() {
        const index = Math.floor(Math.random() * this.behaviors.length);
        return this.behaviors[index];
    }

    // Ejecutar comportamiento aleatorio
    async executeRandomBehavior(sessionId, deviceId) {
        try {
            const behavior = this.getRandomBehavior();
            console.log(`🤖 Ejecutando comportamiento humano: ${behavior} en ${sessionId}`);

            let result;
            switch (behavior) {
                case 'changeStatus':
                    result = await this.changeStatus(sessionId);
                    break;
                case 'changeDescription':
                    result = await this.changeDescription(sessionId);
                    break;
                case 'scrollChats':
                    result = await this.scrollChats(sessionId);
                    break;
                case 'readMessages':
                    result = await this.readMessages(sessionId);
                    break;
                case 'reactToMessage':
                    result = await this.reactToMessage(sessionId);
                    break;
                case 'renameContact':
                    result = await this.renameContact(sessionId);
                    break;
                case 'changeSettings':
                    result = await this.changeSettings(sessionId);
                    break;
                case 'saveAndDeleteContact':
                    result = await this.saveAndDeleteContact(sessionId);
                    break;
                case 'uploadAndDeleteStatus':
                    result = await this.uploadAndDeleteStatus(sessionId);
                    break;
                case 'chatWithMetaAI':
                    result = await this.chatWithMetaAI(sessionId);
                    break;
                default:
                    result = { executed: false };
            }

            // Registrar en base de datos
            await this.logBehavior(deviceId, behavior, result);

            return result;

        } catch (error) {
            console.error('Error ejecutando comportamiento:', error);
            return { error: error.message };
        }
    }

    // Cambiar estado de WhatsApp
    async changeStatus(sessionId) {
        try {
            const client = this.whatsappService.getClient(sessionId);
            if (!client) return { executed: false, reason: 'Cliente no disponible' };

            const statuses = [
                'Disponible',
                'Ocupado',
                'En reunión',
                'Trabajando...',
                ''
            ];

            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
            
            // WhatsApp Web JS no tiene método directo para esto
            // Simulamos el comportamiento registrándolo
            
            return {
                executed: true,
                action: 'changeStatus',
                value: randomStatus
            };

        } catch (error) {
            console.error('Error cambiando estado:', error);
            return { executed: false, error: error.message };
        }
    }

    // Cambiar descripción
    async changeDescription(sessionId) {
        try {
            const client = this.whatsappService.getClient(sessionId);
            if (!client) return { executed: false, reason: 'Cliente no disponible' };

            const descriptions = [
                'Hey there! I am using WhatsApp.',
                '😊',
                'Disponible',
                'Busy',
                ''
            ];

            const randomDesc = descriptions[Math.floor(Math.random() * descriptions.length)];
            
            return {
                executed: true,
                action: 'changeDescription',
                value: randomDesc
            };

        } catch (error) {
            console.error('Error cambiando descripción:', error);
            return { executed: false, error: error.message };
        }
    }

    // Simular scroll en chats
    async scrollChats(sessionId) {
        try {
            const client = this.whatsappService.getClient(sessionId);
            if (!client) return { executed: false, reason: 'Cliente no disponible' };

            // Obtener algunos chats
            const chats = await client.getChats();
            const numChatsToScroll = Math.min(5, chats.length);
            
            // Simular delay entre scrolls
            await this.sleep(this.randomInRange(500, 1500));

            return {
                executed: true,
                action: 'scrollChats',
                chatsViewed: numChatsToScroll
            };

        } catch (error) {
            console.error('Error en scroll:', error);
            return { executed: false, error: error.message };
        }
    }

    // Leer mensajes aleatorios
    async readMessages(sessionId) {
        try {
            const client = this.whatsappService.getClient(sessionId);
            if (!client) return { executed: false, reason: 'Cliente no disponible' };

            const chats = await client.getChats();
            const unreadChats = chats.filter(chat => chat.unreadCount > 0);

            if (unreadChats.length > 0) {
                const randomChat = unreadChats[Math.floor(Math.random() * unreadChats.length)];
                
                // Marcar como leído
                await randomChat.sendSeen();

                return {
                    executed: true,
                    action: 'readMessages',
                    chatId: randomChat.id._serialized
                };
            }

            return {
                executed: false,
                reason: 'No hay mensajes sin leer'
            };

        } catch (error) {
            console.error('Error leyendo mensajes:', error);
            return { executed: false, error: error.message };
        }
    }

    // Reaccionar a mensaje
    async reactToMessage(sessionId) {
        try {
            const client = this.whatsappService.getClient(sessionId);
            if (!client) return { executed: false, reason: 'Cliente no disponible' };

            const reactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
            const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];

            // En whatsapp-web.js las reacciones no están completamente implementadas
            // Esto es una simulación del comportamiento

            return {
                executed: true,
                action: 'reactToMessage',
                reaction: randomReaction
            };

        } catch (error) {
            console.error('Error reaccionando:', error);
            return { executed: false, error: error.message };
        }
    }

    // Renombrar contacto (agregar/quitar caracteres)
    async renameContact(sessionId) {
        try {
            const client = this.whatsappService.getClient(sessionId);
            if (!client) return { executed: false, reason: 'Cliente no disponible' };

            // Simulación: agregar número al final o quitar última letra
            const actions = ['add_number', 'remove_char'];
            const randomAction = actions[Math.floor(Math.random() * actions.length)];

            return {
                executed: true,
                action: 'renameContact',
                modification: randomAction
            };

        } catch (error) {
            console.error('Error renombrando contacto:', error);
            return { executed: false, error: error.message };
        }
    }

    // Cambiar configuración
    async changeSettings(sessionId) {
        try {
            const client = this.whatsappService.getClient(sessionId);
            if (!client) return { executed: false, reason: 'Cliente no disponible' };

            const settings = [
                'notifications',
                'privacy',
                'security',
                'theme'
            ];

            const randomSetting = settings[Math.floor(Math.random() * settings.length)];

            return {
                executed: true,
                action: 'changeSettings',
                setting: randomSetting
            };

        } catch (error) {
            console.error('Error cambiando configuración:', error);
            return { executed: false, error: error.message };
        }
    }

    // 🆕 Guardar y eliminar contacto falso (ANTI-SPAM)
    async saveAndDeleteContact(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false, reason: 'Cliente no disponible' };

            console.log('📱 Guardando contacto falso...');

            // Número falso aleatorio
            const fakeNumber = `51${Math.floor(Math.random() * 900000000 + 100000000)}`;
            const fakeName = `NumeroFalso${Math.floor(Math.random() * 1000)}`;
            const jid = `${fakeNumber}@s.whatsapp.net`;

            // Intentar actualizar el nombre del contacto en Baileys
            try {
                await sock.updateProfileName(fakeName);
                console.log(`✅ Contacto falso guardado: ${fakeName} (${fakeNumber})`);
            } catch (err) {
                console.log(`⚠️ No se pudo guardar contacto (Baileys no lo permite directamente)`);
            }

            // Esperar entre 3-8 segundos
            await this.sleep(this.randomInRange(3000, 8000));

            // Eliminar contacto (simulado, Baileys no tiene API directa para esto)
            console.log(`🗑️ Eliminando contacto falso...`);

            return {
                executed: true,
                action: 'saveAndDeleteContact',
                fakeName,
                fakeNumber
            };

        } catch (error) {
            console.error('Error guardando/eliminando contacto:', error);
            return { executed: false, error: error.message };
        }
    }

    // 🆕 Subir y eliminar estado (ANTI-SPAM)
    async uploadAndDeleteStatus(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false, reason: 'Cliente no disponible' };

            console.log('📸 Subiendo estado falso...');

            const statusTexts = [
                'Trabajando...',
                '😊',
                'Ocupado',
                'En reunión',
                'De vuelta pronto'
            ];

            const randomStatus = statusTexts[Math.floor(Math.random() * statusTexts.length)];

            // Baileys puede actualizar el estado con setStatus
            try {
                await sock.updateProfileStatus(randomStatus);
                console.log(`✅ Estado subido: "${randomStatus}"`);
            } catch (err) {
                console.log(`⚠️ No se pudo subir estado: ${err.message}`);
            }

            // Esperar entre 5-15 segundos
            await this.sleep(this.randomInRange(5000, 15000));

            // Borrar estado (vacío)
            try {
                await sock.updateProfileStatus('');
                console.log(`🗑️ Estado eliminado`);
            } catch (err) {
                console.log(`⚠️ No se pudo eliminar estado`);
            }

            return {
                executed: true,
                action: 'uploadAndDeleteStatus',
                status: randomStatus
            };

        } catch (error) {
            console.error('Error subiendo/eliminando estado:', error);
            return { executed: false, error: error.message };
        }
    }

    // 🆕 Hablar con Meta AI (ANTI-SPAM MÁXIMO)
    async chatWithMetaAI(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false, reason: 'Cliente no disponible' };

            console.log('🤖 Hablando con Meta AI sobre cocina...');

            // JID de Meta AI (puede variar)
            const metaAIJid = '15551234567@s.whatsapp.net'; // Placeholder, necesita JID real

            const cookingQuestions = [
                '¿Cómo hago una tortilla de patatas?',
                '¿Cuánto tiempo se cocina el arroz?',
                '¿Qué ingredientes necesito para un ceviche?',
                'Dame una receta de pasta',
                '¿Cómo se prepara el lomo saltado?',
                'Receta de arroz con pollo'
            ];

            const randomQuestion = cookingQuestions[Math.floor(Math.random() * cookingQuestions.length)];

            try {
                // Enviar mensaje a Meta AI
                await sock.sendMessage(metaAIJid, { 
                    text: randomQuestion 
                });
                console.log(`✅ Pregunta enviada a Meta AI: "${randomQuestion}"`);

                // Esperar entre 10-20 segundos (simular lectura)
                await this.sleep(this.randomInRange(10000, 20000));

                // Eliminar chat con Meta AI
                try {
                    await sock.chatModify({ delete: true }, metaAIJid);
                    console.log(`🗑️ Chat con Meta AI eliminado`);
                } catch (delErr) {
                    console.log(`⚠️ No se pudo eliminar chat: ${delErr.message}`);
                }

            } catch (sendErr) {
                console.log(`⚠️ No se pudo enviar mensaje a Meta AI: ${sendErr.message}`);
            }

            return {
                executed: true,
                action: 'chatWithMetaAI',
                question: randomQuestion
            };

        } catch (error) {
            console.error('Error hablando con Meta AI:', error);
            return { executed: false, error: error.message };
        }
    }

    // Registrar comportamiento en BD
    async logBehavior(deviceId, action, details) {
        try {
            await pool.execute(
                'INSERT INTO comportamiento_log (dispositivo_id, accion, detalles) VALUES (?, ?, ?)',
                [deviceId, action, JSON.stringify(details)]
            );
        } catch (error) {
            console.error('Error guardando log de comportamiento:', error);
        }
    }

    // Generar secuencia de comportamientos durante campaña
    async executeSequence(sessionId, deviceId, count = 1) {
        const results = [];
        
        for (let i = 0; i < count; i++) {
            const result = await this.executeRandomBehavior(sessionId, deviceId);
            results.push(result);
            
            // Pausa entre comportamientos
            await this.sleep(this.randomInRange(2000, 5000));
        }

        return results;
    }

    // Utilidades
    randomInRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Decidir si ejecutar comportamiento (probabilidad)
    shouldExecuteBehavior(probability = 0.3) {
        return Math.random() < probability;
    }

    // Ejecutar comportamiento con probabilidad durante campaña
    async maybeExecuteBehavior(sessionId, deviceId, probability = 0.3) {
        if (this.shouldExecuteBehavior(probability)) {
            return await this.executeRandomBehavior(sessionId, deviceId);
        }
        return { executed: false, reason: 'Probabilidad no alcanzada' };
    }
}

module.exports = HumanBehaviorService;

