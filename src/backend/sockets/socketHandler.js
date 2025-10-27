const WhatsAppService = require('../services/whatsappServiceBaileys');
const CampaignService = require('../services/campaignService');
const { pool } = require('../../config/database');

let whatsappService;
let campaignService;

function initializeSocketHandlers(io) {
    // Inicializar servicios
    whatsappService = new WhatsAppService(io);
    campaignService = new CampaignService(whatsappService, io);

    io.on('connection', (socket) => {
        console.log('✅ Cliente conectado:', socket.id);

        // Crear sesión de WhatsApp
        socket.on('create-session', async (data) => {
            try {
                const { sessionId, userId, deviceId } = data;
                
                console.log(`📱 Solicitud de crear sesión recibida:`, {
                    sessionId,
                    userId,
                    deviceId
                });
                
                await whatsappService.createSession(sessionId, userId, deviceId);
                
                console.log(`✅ Sesión ${sessionId} inicializada, esperando QR...`);
                
                socket.emit('session-created', {
                    success: true,
                    sessionId
                });

            } catch (error) {
                console.error('❌ Error creando sesión:', error);
                console.error(error.stack);
                socket.emit('session-error', {
                    error: true,
                    message: error.message
                });
            }
        });

        // Cerrar sesión
        socket.on('destroy-session', async (data) => {
            try {
                const { sessionId } = data;
                
                await whatsappService.destroySession(sessionId);
                
                socket.emit('session-destroyed', {
                    success: true,
                    sessionId
                });

            } catch (error) {
                console.error('Error destruyendo sesión:', error);
                socket.emit('session-error', {
                    error: true,
                    message: error.message
                });
            }
        });

        // Enviar mensaje manual
        socket.on('send-manual-message', async (data) => {
            try {
                const { sessionId, phoneNumbers, message } = data;
                
                const results = [];

                for (const phone of phoneNumbers) {
                    try {
                        await whatsappService.sendMessage(sessionId, phone, message);
                        results.push({ phone, success: true });
                    } catch (error) {
                        results.push({ phone, success: false, error: error.message });
                    }

                    // Pausa entre mensajes
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                socket.emit('manual-message-sent', {
                    success: true,
                    results
                });

            } catch (error) {
                console.error('Error enviando mensaje manual:', error);
                socket.emit('message-error', {
                    error: true,
                    message: error.message
                });
            }
        });

        // Obtener chats de una sesión
        socket.on('get-chats', async (data) => {
            try {
                const { sessionId } = data;
                
                const chats = await whatsappService.getChats(sessionId);
                
                socket.emit('chats-received', {
                    success: true,
                    sessionId,
                    chats
                });

            } catch (error) {
                console.error('Error obteniendo chats:', error);
                socket.emit('chats-error', {
                    error: true,
                    message: error.message
                });
            }
        });

        // Obtener mensajes de un chat
        socket.on('get-chat-messages', async (data) => {
            try {
                const { sessionId, chatId } = data;
                
                const messages = await whatsappService.getChatMessages(sessionId, chatId);
                
                socket.emit('chat-messages-received', {
                    success: true,
                    sessionId,
                    chatId,
                    messages
                });

            } catch (error) {
                console.error('Error obteniendo mensajes:', error);
                socket.emit('messages-error', {
                    error: true,
                    message: error.message
                });
            }
        });

        // Enviar respuesta a un chat
        socket.on('send-chat-reply', async (data) => {
            try {
                const { sessionId, phoneNumber, message } = data;
                
                await whatsappService.sendMessage(sessionId, phoneNumber, message);
                
                socket.emit('reply-sent', {
                    success: true,
                    phoneNumber
                });

            } catch (error) {
                console.error('Error enviando respuesta:', error);
                socket.emit('reply-error', {
                    error: true,
                    message: error.message
                });
            }
        });

        // Desconexión
        socket.on('disconnect', () => {
            console.log('Cliente desconectado:', socket.id);
        });
    });

    return { whatsappService, campaignService };
}

module.exports = { initializeSocketHandlers };

