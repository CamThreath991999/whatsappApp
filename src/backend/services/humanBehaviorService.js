const { pool } = require('../../config/database');

class HumanBehaviorService {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
        this.behaviors = [
            // Comportamientos básicos (alta frecuencia) - MUY REALISTAS
            'slowScrollChats',              // 🔥 Desplazamiento lento con pasos
            'readMultipleMessagesSlowly',   // 🔥 Leer mensajes con pausas naturales
            'microPause',                   // 🔥 Micropausa (distracción)
            'scrollChats',                  // Desplazarse por chats
            'readMessages',                 // Leer mensajes
            'viewRandomChat',               // Ver chat aleatorio
            'typingSimulation',             // Simular escritura sin enviar
            
            // Comportamientos de interacción (media frecuencia)
            'viewProfilePictureWithDelay',  // 🔥 Ver foto de perfil POR SEGUNDOS
            'reactToRandomMessage',         // Reaccionar a mensaje
            'viewProfilePicture',           // Ver foto de perfil
            'searchContact',                // Buscar contacto
            'refreshChatList',              // Refrescar lista de chats
            
            // Comportamientos de configuración (baja frecuencia)
            'updateProfileDescriptionGradual', // 🔥 Cambiar descripción GRADUALMENTE
            'changeStatus',                    // Cambiar estado
            'changeDescription',               // Cambiar descripción
            'changeSettings',                  // Cambiar ajustes
            'archiveUnarchiveChat',            // Archivar/desarchivar chat
            
            // Comportamientos avanzados (muy baja frecuencia)
            'saveAndDeleteContact',         // Guardar/eliminar contacto falso
            'uploadAndDeleteStatus',        // Subir/borrar estado
            'chatWithMetaAI',              // Hablar con Meta AI (preguntas variadas)
            'muteUnmuteChat',              // Silenciar/reactivar chat
            'starUnstarMessage'            // Destacar/quitar estrella
        ];
        
        // Pesos de probabilidad para cada comportamiento (MUY REALISTA)
        this.behaviorWeights = {
            // Comportamientos super realistas (frecuentes)
            'slowScrollChats': 25,                  // 🔥 MUY COMÚN
            'readMultipleMessagesSlowly': 22,       // 🔥 MUY COMÚN
            'microPause': 20,                       // 🔥 MUY COMÚN (pausas naturales)
            'scrollChats': 18,
            'readMessages': 16,
            'viewRandomChat': 14,
            'typingSimulation': 12,
            
            // Interacciones realistas (media frecuencia)
            'viewProfilePictureWithDelay': 15,      // 🔥 Ver foto por segundos
            'reactToRandomMessage': 10,
            'viewProfilePicture': 8,
            'searchContact': 6,
            'refreshChatList': 5,
            
            // Configuración (baja frecuencia)
            'updateProfileDescriptionGradual': 4,   // 🔥 Cambiar descripción gradual
            'changeStatus': 3,
            'changeDescription': 2,
            'changeSettings': 1,
            'archiveUnarchiveChat': 1,
            
            // Avanzados (muy baja frecuencia)
            'saveAndDeleteContact': 0.8,
            'uploadAndDeleteStatus': 0.7,
            'chatWithMetaAI': 0.6,                  // 🔥 Mejorado con preguntas variadas
            'muteUnmuteChat': 0.5,
            'starUnstarMessage': 0.4
        };
    }

    // Obtener comportamiento aleatorio basado en pesos
    getRandomBehavior() {
        const totalWeight = Object.values(this.behaviorWeights).reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const behavior of this.behaviors) {
            const weight = this.behaviorWeights[behavior] || 1;
            random -= weight;
            if (random <= 0) {
                return behavior;
            }
        }
        
        // Fallback
        return this.behaviors[Math.floor(Math.random() * this.behaviors.length)];
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
                case 'viewRandomChat':
                    result = await this.viewRandomChat(sessionId);
                    break;
                case 'viewProfilePicture':
                    result = await this.viewProfilePicture(sessionId);
                    break;
                case 'reactToRandomMessage':
                    result = await this.reactToRandomMessage(sessionId);
                    break;
                case 'typingSimulation':
                    result = await this.typingSimulation(sessionId);
                    break;
                case 'searchContact':
                    result = await this.searchContact(sessionId);
                    break;
                case 'refreshChatList':
                    result = await this.refreshChatList(sessionId);
                    break;
                case 'archiveUnarchiveChat':
                    result = await this.archiveUnarchiveChat(sessionId);
                    break;
                case 'muteUnmuteChat':
                    result = await this.muteUnmuteChat(sessionId);
                    break;
                case 'starUnstarMessage':
                    result = await this.starUnstarMessage(sessionId);
                    break;
                case 'slowScrollChats':
                    result = await this.slowScrollChats(sessionId);
                    break;
                case 'readMultipleMessagesSlowly':
                    result = await this.readMultipleMessagesSlowly(sessionId);
                    break;
                case 'microPause':
                    result = await this.microPause(sessionId);
                    break;
                case 'viewProfilePictureWithDelay':
                    result = await this.viewProfilePictureWithDelay(sessionId);
                    break;
                case 'updateProfileDescriptionGradual':
                    result = await this.updateProfileDescriptionGradual(sessionId);
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

            console.log('🤖 Hablando con Meta AI...');

            // JID de Meta AI (puede variar)
            const metaAIJid = '15551234567@s.whatsapp.net'; // Placeholder, necesita JID real

            // **PREGUNTAS VARIADAS Y ALEATORIAS**
            const questionTypes = {
                math: [
                    `¿Cuánto es ${this.randomInRange(10, 99)} + ${this.randomInRange(10, 99)}?`,
                    `¿Cuánto es ${this.randomInRange(5, 20)} × ${this.randomInRange(2, 12)}?`,
                    `¿Cuál es la raíz cuadrada de ${this.randomInRange(4, 16) * this.randomInRange(4, 16)}?`,
                    `Si tengo ${this.randomInRange(50, 200)} soles y gasto ${this.randomInRange(20, 100)}, ¿cuánto me queda?`,
                    `¿Cuánto es ${this.randomInRange(100, 500)} dividido entre ${this.randomInRange(2, 10)}?`
                ],
                cooking: [
                    '¿Cómo hago una tortilla de patatas?',
                    '¿Cuánto tiempo se cocina el arroz?',
                    '¿Qué ingredientes necesito para un ceviche?',
                    'Dame una receta de pasta rápida',
                    '¿Cómo se prepara el lomo saltado?'
                ],
                general: [
                    '¿Qué tiempo hará mañana?',
                    '¿A qué hora amanece hoy?',
                    'Cuéntame un chiste corto',
                    '¿Cuál es la capital de Francia?',
                    'Dame un dato curioso'
                ],
                productivity: [
                    '¿Cómo organizar mejor mi tiempo?',
                    'Dame consejos para ser más productivo',
                    '¿Qué es la técnica Pomodoro?',
                    'Ayúdame a hacer una lista de tareas'
                ]
            };

            // Seleccionar tipo de pregunta aleatoriamente
            const types = Object.keys(questionTypes);
            const randomType = types[Math.floor(Math.random() * types.length)];
            const questions = questionTypes[randomType];
            const randomQuestion = questions[Math.floor(Math.random() * questions.length)];

            console.log(`   📝 Tipo: ${randomType} - Pregunta: "${randomQuestion}"`);

            try {
                // Enviar mensaje a Meta AI
                await sock.sendMessage(metaAIJid, { 
                    text: randomQuestion 
                });
                console.log(`   ✅ Pregunta enviada a Meta AI`);

                // Esperar entre 8-15 segundos (simular lectura de respuesta)
                const readTime = this.randomInRange(8000, 15000);
                await this.sleep(readTime);

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

    // 🆕 Ver chat aleatorio (ANTI-SPAM)
    async viewRandomChat(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false, reason: 'Cliente no disponible' };

            console.log('👁️ Viendo chat aleatorio...');

            // Obtener chats disponibles
            const chats = await sock.groupFetchAllParticipating().catch(() => ({}));
            const chatIds = Object.keys(chats);

            if (chatIds.length === 0) {
                console.log('⚠️ No hay chats disponibles');
                return { executed: false, reason: 'Sin chats disponibles' };
            }

            // Seleccionar chat aleatorio
            const randomChatId = chatIds[Math.floor(Math.random() * chatIds.length)];
            console.log(`✅ Viendo chat: ${randomChatId}`);

            // Simular lectura de mensajes (obtener mensajes)
            try {
                const messages = await sock.fetchMessagesFromWA(randomChatId, 20);
                console.log(`   📨 ${messages?.length || 0} mensajes obtenidos`);
            } catch (err) {
                console.log(`   ⚠️ No se pudieron obtener mensajes: ${err.message}`);
            }

            // Esperar entre 5-15 segundos (simular lectura)
            await this.sleep(this.randomInRange(5000, 15000));

            return {
                executed: true,
                action: 'viewRandomChat',
                chatId: randomChatId
            };

        } catch (error) {
            console.error('Error viendo chat aleatorio:', error);
            return { executed: false, error: error.message };
        }
    }

    // 🆕 Ver foto de perfil (ANTI-SPAM)
    async viewProfilePicture(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false, reason: 'Cliente no disponible' };

            console.log('🖼️ Viendo foto de perfil...');

            // Obtener contactos recientes
            const chats = await sock.groupFetchAllParticipating().catch(() => ({}));
            const chatIds = Object.keys(chats);

            if (chatIds.length === 0) {
                console.log('⚠️ No hay contactos disponibles');
                return { executed: false, reason: 'Sin contactos' };
            }

            // Seleccionar contacto aleatorio
            const randomContactId = chatIds[Math.floor(Math.random() * chatIds.length)];

            // Intentar obtener foto de perfil
            try {
                const profilePic = await sock.profilePictureUrl(randomContactId, 'image');
                console.log(`✅ Foto de perfil obtenida: ${profilePic ? 'Sí' : 'No'}`);
            } catch (err) {
                console.log(`   ⚠️ No se pudo obtener foto de perfil: ${err.message}`);
            }

            // Esperar 3-8 segundos (simular que viste la foto)
            await this.sleep(this.randomInRange(3000, 8000));

            return {
                executed: true,
                action: 'viewProfilePicture',
                contactId: randomContactId
            };

        } catch (error) {
            console.error('Error viendo foto de perfil:', error);
            return { executed: false, error: error.message };
        }
    }

    // 🆕 Reaccionar a mensaje aleatorio (ANTI-SPAM)
    async reactToRandomMessage(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false, reason: 'Cliente no disponible' };

            console.log('😊 Reaccionando a mensaje aleatorio...');

            // Obtener chats
            const chats = await sock.groupFetchAllParticipating().catch(() => ({}));
            const chatIds = Object.keys(chats);

            if (chatIds.length === 0) {
                console.log('⚠️ No hay chats disponibles');
                return { executed: false, reason: 'Sin chats' };
            }

            // Seleccionar chat aleatorio
            const randomChatId = chatIds[Math.floor(Math.random() * chatIds.length)];

            // Obtener mensajes recientes
            try {
                const messages = await sock.fetchMessagesFromWA(randomChatId, 10);
                
                if (messages && messages.length > 0) {
                    // Seleccionar mensaje aleatorio
                    const randomMsg = messages[Math.floor(Math.random() * messages.length)];

                    // Emojis de reacción
                    const reactions = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'];
                    const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];

                    // Reaccionar al mensaje
                    await sock.sendMessage(randomChatId, {
                        react: {
                            text: randomReaction,
                            key: randomMsg.key
                        }
                    });

                    console.log(`✅ Reacción enviada: ${randomReaction} al mensaje ${randomMsg.key.id}`);

                    return {
                        executed: true,
                        action: 'reactToRandomMessage',
                        reaction: randomReaction,
                        chatId: randomChatId,
                        messageId: randomMsg.key.id
                    };
                }
            } catch (err) {
                console.log(`   ⚠️ No se pudo reaccionar: ${err.message}`);
            }

            return { executed: false, reason: 'No se pudo reaccionar' };

        } catch (error) {
            console.error('Error reaccionando a mensaje:', error);
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

    // 🆕 NUEVOS COMPORTAMIENTOS

    // Simular escritura sin enviar mensaje
    async typingSimulation(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false };

            // Duración aleatoria de escritura (3-10 segundos)
            const typingDuration = Math.floor(Math.random() * 7000) + 3000;
            
            console.log(`   ⌨️ Simulando escritura por ${typingDuration}ms`);
            await this.sleep(typingDuration);
            
            return { executed: true, action: 'typingSimulation', duration: typingDuration };
        } catch (error) {
            return { executed: false, error: error.message };
        }
    }

    // Buscar contacto
    async searchContact(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false };

            const searchTerms = ['Juan', 'Maria', 'Carlos', 'Ana', 'Luis', 'Pedro', 'Sofia'];
            const searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
            
            console.log(`   🔍 Simulando búsqueda de: ${searchTerm}`);
            await this.sleep(Math.floor(Math.random() * 3000) + 2000);
            
            return { executed: true, action: 'searchContact', searchTerm };
        } catch (error) {
            return { executed: false, error: error.message };
        }
    }

    // Refrescar lista de chats
    async refreshChatList(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false };

            console.log(`   🔄 Refrescando lista de chats`);
            await this.sleep(Math.floor(Math.random() * 2000) + 1000);
            
            return { executed: true, action: 'refreshChatList' };
        } catch (error) {
            return { executed: false, error: error.message };
        }
    }

    // Archivar/desarchivar chat
    async archiveUnarchiveChat(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false };

            const action = Math.random() > 0.5 ? 'archive' : 'unarchive';
            console.log(`   📦 Simulando ${action} de chat`);
            await this.sleep(Math.floor(Math.random() * 2000) + 1000);
            
            return { executed: true, action: 'archiveUnarchiveChat', type: action };
        } catch (error) {
            return { executed: false, error: error.message };
        }
    }

    // Silenciar/reactivar chat
    async muteUnmuteChat(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false };

            const action = Math.random() > 0.5 ? 'mute' : 'unmute';
            console.log(`   🔕 Simulando ${action} de chat`);
            await this.sleep(Math.floor(Math.random() * 2000) + 1000);
            
            return { executed: true, action: 'muteUnmuteChat', type: action };
        } catch (error) {
            return { executed: false, error: error.message };
        }
    }

    // Destacar/quitar estrella de mensaje
    async starUnstarMessage(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false };

            const action = Math.random() > 0.5 ? 'star' : 'unstar';
            console.log(`   ⭐ Simulando ${action} mensaje`);
            await this.sleep(Math.floor(Math.random() * 2000) + 1000);
            
            return { executed: true, action: 'starUnstarMessage', type: action };
        } catch (error) {
            return { executed: false, error: error.message };
        }
    }

    // 🆕 **COMPORTAMIENTOS SUPER REALISTAS**

    // Ver foto de perfil de un contacto por varios segundos
    async viewProfilePictureWithDelay(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false };

            // Simular: Abrir perfil → Ver foto → Hacer zoom → Esperar → Cerrar
            console.log(`   👤 Viendo foto de perfil de contacto aleatorio...`);
            
            // Paso 1: Abrir perfil (1-2s)
            await this.sleep(this.randomInRange(1000, 2000));
            console.log(`      🔍 Abrió perfil`);
            
            // Paso 2: Ver foto completa (3-8s) - simula que la persona mira la foto
            const viewDuration = this.randomInRange(3000, 8000);
            await this.sleep(viewDuration);
            console.log(`      👀 Vio foto por ${Math.floor(viewDuration/1000)}s`);
            
            // Paso 3: Tal vez hacer zoom (30% probabilidad)
            if (Math.random() < 0.3) {
                await this.sleep(this.randomInRange(2000, 4000));
                console.log(`      🔎 Hizo zoom en la foto`);
            }
            
            // Paso 4: Cerrar perfil (0.5-1s)
            await this.sleep(this.randomInRange(500, 1000));
            console.log(`      ❌ Cerró perfil`);
            
            return { 
                executed: true, 
                action: 'viewProfilePictureWithDelay', 
                duration: viewDuration 
            };
        } catch (error) {
            return { executed: false, error: error.message };
        }
    }

    // Desplazamiento lento por la lista de chats (scroll simulado)
    async slowScrollChats(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false };

            console.log(`   📜 Desplazamiento lento por chats...`);
            
            // Simular scroll en pasos pequeños
            const scrollSteps = this.randomInRange(3, 7); // 3-7 pasos de scroll
            
            for (let i = 0; i < scrollSteps; i++) {
                // Cada paso de scroll toma 0.5-1.5s
                await this.sleep(this.randomInRange(500, 1500));
                console.log(`      ⬇️ Scroll paso ${i+1}/${scrollSteps}`);
            }
            
            // Pausa al final (como si leyera algo)
            await this.sleep(this.randomInRange(2000, 4000));
            console.log(`      ✅ Terminó de scrollear`);
            
            return { 
                executed: true, 
                action: 'slowScrollChats', 
                steps: scrollSteps 
            };
        } catch (error) {
            return { executed: false, error: error.message };
        }
    }

    // Cambiar descripción del usuario de forma gradual
    async updateProfileDescriptionGradual(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false };

            const descriptions = [
                'Disponible 📱',
                'En reunión 💼',
                'Ocupado...',
                'Trabajando 💻',
                'De vacaciones 🌴',
                'Hey there! I am using WhatsApp',
                '¡Hola! 👋',
                'No disponible'
            ];

            console.log(`   ✏️ Cambiando descripción del perfil...`);
            
            // Paso 1: Abrir configuración de perfil (1-2s)
            await this.sleep(this.randomInRange(1000, 2000));
            console.log(`      📝 Abrió edición de perfil`);
            
            // Paso 2: Borrar descripción anterior (simular teclas) (2-4s)
            await this.sleep(this.randomInRange(2000, 4000));
            console.log(`      🗑️ Borró descripción anterior`);
            
            // Paso 3: Escribir nueva descripción (simular tipeo lento) (3-7s)
            const newDescription = descriptions[Math.floor(Math.random() * descriptions.length)];
            const typingTime = newDescription.length * this.randomInRange(100, 300); // tiempo por carácter
            await this.sleep(typingTime);
            console.log(`      ⌨️ Escribió: "${newDescription}"`);
            
            // Paso 4: Guardar (1s)
            await this.sleep(1000);
            
            try {
                await sock.updateProfileStatus(newDescription);
                console.log(`      ✅ Descripción actualizada`);
            } catch (err) {
                console.log(`      ⚠️ No se pudo actualizar descripción (simulado)`);
            }
            
            return { 
                executed: true, 
                action: 'updateProfileDescriptionGradual', 
                newDescription 
            };
        } catch (error) {
            return { executed: false, error: error.message };
        }
    }

    // Leer varios mensajes de un chat con pausas (simula lectura humana)
    async readMultipleMessagesSlowly(sessionId) {
        try {
            const sock = this.whatsappService.getClient(sessionId);
            if (!sock) return { executed: false };

            console.log(`   📖 Leyendo mensajes lentamente...`);
            
            // Simular leer entre 3-8 mensajes
            const messagesToRead = this.randomInRange(3, 8);
            
            for (let i = 0; i < messagesToRead; i++) {
                // Tiempo de lectura por mensaje (depende de longitud simulada)
                const readTime = this.randomInRange(1500, 4000);
                await this.sleep(readTime);
                console.log(`      👁️ Leyó mensaje ${i+1}/${messagesToRead}`);
                
                // Pausa entre mensajes (como si pensara)
                if (i < messagesToRead - 1) {
                    await this.sleep(this.randomInRange(500, 1500));
                }
            }
            
            console.log(`      ✅ Terminó de leer`);
            
            return { 
                executed: true, 
                action: 'readMultipleMessagesSlowly', 
                messagesRead: messagesToRead 
            };
        } catch (error) {
            return { executed: false, error: error.message };
        }
    }

    // Micropausa (simula distracción momentánea)
    async microPause(sessionId) {
        try {
            const pauseReasons = [
                'Tomando agua',
                'Mirando notificación',
                'Ajustando posición',
                'Parpadeo largo',
                'Pensando'
            ];
            
            const reason = pauseReasons[Math.floor(Math.random() * pauseReasons.length)];
            const pauseDuration = this.randomInRange(2000, 5000);
            
            console.log(`   ⏸️ Micropausa: ${reason} (${Math.floor(pauseDuration/1000)}s)`);
            await this.sleep(pauseDuration);
            
            return { 
                executed: true, 
                action: 'microPause', 
                reason, 
                duration: pauseDuration 
            };
        } catch (error) {
            return { executed: false, error: error.message };
        }
    }

    // Helper: Random in range
    randomInRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

module.exports = HumanBehaviorService;
