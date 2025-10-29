/**
 * Servicio de WhatsApp usando Baileys (sin Puppeteer)
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { pool } = require('../../config/database');
const redisHelper = require('../utils/redisHelper');

class WhatsAppServiceBaileys {
    constructor(io) {
        this.io = io;
        this.clients = new Map(); // sessionId -> socket
        this.authStates = new Map(); // sessionId -> authState
    }

    async createSession(sessionId, userId, deviceId) {
        try {
            console.log(`\n🔧 Iniciando sesión Baileys: ${sessionId}`);
            
            // Crear directorio de autenticación
            const authPath = path.join(__dirname, '../../../sessions', sessionId);
            if (!fs.existsSync(authPath)) {
                fs.mkdirSync(authPath, { recursive: true });
            }

            // Cargar estado de autenticación
            const { state, saveCreds } = await useMultiFileAuthState(authPath);
            
            // Obtener versión más reciente de Baileys
            const { version, isLatest } = await fetchLatestBaileysVersion();
            console.log(`📱 Usando WA v${version.join('.')}, isLatest: ${isLatest}`);

            // Crear socket de WhatsApp
            const sock = makeWASocket({
                version,
                printQRInTerminal: false,
                auth: state,
                browser: ['WhatsApp Masivo', 'Chrome', '1.0.0'],
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 0,
                keepAliveIntervalMs: 10000,
                emitOwnEvents: true,
                markOnlineOnConnect: true,
            });

            // Guardar socket
            this.clients.set(sessionId, sock);
            this.authStates.set(sessionId, { state, saveCreds });

            // Evento: Actualización de conexión
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // Generar QR
                if (qr) {
                    console.log(`\n🎯🎯🎯 ¡¡¡QR GENERADO!!! 🎯🎯🎯`);
                    console.log(`   Sesión: ${sessionId}`);
                    
                    try {
                        // Convertir QR a imagen base64
                        const qrImage = await qrcode.toDataURL(qr);
                        console.log(`   ✅ QR convertido: ${qrImage.length} chars`);

                        // Actualizar BD
                        await pool.execute(
                            'UPDATE dispositivos SET estado = ? WHERE session_id = ?',
                            ['esperando_qr', sessionId]
                        );
                        console.log(`   ✅ BD actualizada`);

                        // Emitir a frontend
                        this.io.emit(`qr-${sessionId}`, {
                            sessionId,
                            qr: qrImage
                        });
                        console.log(`   ✅✅✅ QR EMITIDO! ✅✅✅\n`);

                        // Guardar en Redis
                        await redisHelper.setCache(`qr:${sessionId}`, qrImage, 120);
                        console.log(`   ✅ Guardado en Redis\n`);
                    } catch (error) {
                        console.error(`   ❌ Error procesando QR:`, error);
                    }
                }

                // Conexión cerrada
                if (connection === 'close') {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log(`❌ Conexión cerrada. Reconectar: ${shouldReconnect}`);
                    
                    if (shouldReconnect) {
                        console.log('🔄 Reintentando conexión...');
                        setTimeout(() => this.createSession(sessionId, userId, deviceId), 3000);
                    } else {
                        this.clients.delete(sessionId);
                        this.authStates.delete(sessionId);
                        
                        await pool.execute(
                            'UPDATE dispositivos SET estado = ? WHERE session_id = ?',
                            ['desconectado', sessionId]
                        );
                    }
                }

                // Conexión abierta (autenticado)
                if (connection === 'open') {
                    console.log(`✅ Sesión ${sessionId} conectada!`);
                    
                    const phoneNumber = sock.user.id.split(':')[0];
                    
                    await pool.execute(
                        'UPDATE dispositivos SET estado = ?, numero_telefono = ? WHERE session_id = ?',
                        ['conectado', phoneNumber, sessionId]
                    );

                    this.io.emit(`authenticated-${sessionId}`, {
                        sessionId,
                        phoneNumber
                    });
                }
            });

            // Evento: Recibir mensajes
            sock.ev.on('messages.upsert', async ({ messages, type }) => {
                for (const msg of messages) {
                    if (msg.key.fromMe) continue; // Ignorar mensajes propios
                    
                    const chatId = msg.key.remoteJid;
                    const messageText = msg.message?.conversation || 
                                      msg.message?.extendedTextMessage?.text || '';
                    
                    console.log(`📨 Mensaje recibido en ${sessionId}: ${chatId.substring(0, 15)}...`);
                    
                    // Guardar chat
                    await this.saveChat(sessionId, chatId, messageText, msg);
                    
                    // Emitir nuevo mensaje al frontend
                    this.io.emit(`new-message-${sessionId}`, {
                        sessionId,
                        chatId,
                        message: messageText,
                        timestamp: msg.messageTimestamp
                    });
                }
            });

            // Evento: Actualizar credenciales
            sock.ev.on('creds.update', saveCreds);

            console.log(`✅ Socket Baileys creado para ${sessionId}`);

        } catch (error) {
            console.error(`❌ Error creando sesión Baileys ${sessionId}:`, error);
            throw error;
        }
    }

    async sendMessage(sessionId, to, message) {
        try {
            const sock = this.clients.get(sessionId);
            if (!sock) {
                throw new Error(`Sesión ${sessionId} no encontrada`);
            }

            // Limpiar el número de entrada (eliminar espacios, guiones, etc.)
            let cleanNumber = to.toString().replace(/\D/g, '');
            
            // Formato correcto del número
            // Si ya tiene @s.whatsapp.net, usarlo tal cual
            // Si no, agregarlo
            const jid = to.includes('@s.whatsapp.net') ? to : `${cleanNumber}@s.whatsapp.net`;

            await sock.sendMessage(jid, { text: message });
            console.log(`✅ Mensaje enviado a ${cleanNumber} (JID: ${jid}) desde ${sessionId}`);

            // ✅ CORRECCIÓN: Guardar el mensaje saliente en chats.json
            await this.saveChatOutgoing(sessionId, jid, message);

            return { success: true };
        } catch (error) {
            console.error(`❌ Error enviando mensaje:`, error);
            throw error;
        }
    }

    // Enviar mensaje con imagen
    async sendMessageWithImage(sessionId, to, message, imagePath) {
        try {
            const sock = this.clients.get(sessionId);
            if (!sock) {
                throw new Error(`Sesión ${sessionId} no encontrada`);
            }

            // Limpiar el número de entrada
            let cleanNumber = to.toString().replace(/\D/g, '');
            
            // Formato correcto del número
            const jid = to.includes('@s.whatsapp.net') ? to : `${cleanNumber}@s.whatsapp.net`;

            // Verificar si la ruta es absoluta o relativa
            let fullImagePath = imagePath;
            if (!path.isAbsolute(imagePath)) {
                fullImagePath = path.join(__dirname, '../../../uploads', imagePath);
            }

            // Verificar que el archivo exista
            if (!fs.existsSync(fullImagePath)) {
                console.error(`❌ Imagen no encontrada: ${fullImagePath}`);
                throw new Error(`Imagen no encontrada: ${fullImagePath}`);
            }

            // Leer la imagen y enviarla
            const imageBuffer = fs.readFileSync(fullImagePath);
            
            await sock.sendMessage(jid, {
                image: imageBuffer,
                caption: message
            });

            console.log(`✅ Imagen enviada a ${cleanNumber} (JID: ${jid}) desde ${sessionId}`);

            // Guardar el mensaje saliente en chats.json
            await this.saveChatOutgoing(sessionId, jid, `📎 ${message}`);

            return { success: true };
        } catch (error) {
            console.error(`❌ Error enviando mensaje con imagen:`, error);
            throw error;
        }
    }

    async getChats(sessionId) {
        try {
            const sock = this.clients.get(sessionId);
            if (!sock) {
                throw new Error(`Sesión ${sessionId} no encontrada`);
            }

            // Obtener chats almacenados
            const chatsPath = path.join(__dirname, '../../../sessions', sessionId, 'chats.json');
            let chats = [];

            if (fs.existsSync(chatsPath)) {
                const chatsData = fs.readFileSync(chatsPath, 'utf8');
                chats = JSON.parse(chatsData);
            }

            // Si no hay chats guardados, devolver array vacío
            console.log(`📨 ${chats.length} chats encontrados para ${sessionId}`);
            return chats;
        } catch (error) {
            console.error(`❌ Error obteniendo chats:`, error);
            return [];
        }
    }

    // Obtener cliente/socket (para compatibilidad con campaignService)
    getClient(sessionId) {
        return this.clients.get(sessionId);
    }

    // Obtener socket de sesión
    getSocket(sessionId) {
        return this.clients.get(sessionId);
    }

    async disconnectSession(sessionId) {
        try {
            const sock = this.clients.get(sessionId);
            if (sock) {
                await sock.logout();
                this.clients.delete(sessionId);
                this.authStates.delete(sessionId);

                // Limpiar directorio de sesión
                const authPath = path.join(__dirname, '../../../sessions', sessionId);
                if (fs.existsSync(authPath)) {
                    fs.rmSync(authPath, { recursive: true, force: true });
                }

                await pool.execute(
                    'UPDATE dispositivos SET estado = ?, session_id = NULL WHERE session_id = ?',
                    ['desconectado', sessionId]
                );

                console.log(`✅ Sesión ${sessionId} desconectada`);
            }
        } catch (error) {
            console.error(`❌ Error desconectando sesión:`, error);
            throw error;
        }
    }

    // Alias para compatibilidad
    async destroySession(sessionId) {
        return await this.disconnectSession(sessionId);
    }

    async getChatMessages(sessionId, chatId) {
        try {
            const sock = this.clients.get(sessionId);
            if (!sock) {
                throw new Error(`Sesión ${sessionId} no encontrada`);
            }

            // Obtener mensajes del store
            const messages = await sock.store?.messages?.[chatId]?.array() || [];
            return messages;
        } catch (error) {
            console.error(`❌ Error obteniendo mensajes:`, error);
            throw error;
        }
    }

    isSessionActive(sessionId) {
        return this.clients.has(sessionId);
    }

    getActiveSessionsCount() {
        return this.clients.size;
    }

    async saveChat(sessionId, chatId, message, fullMessage) {
        try {
            const chatsPath = path.join(__dirname, '../../../sessions', sessionId, 'chats.json');
            const sessionPath = path.join(__dirname, '../../../sessions', sessionId);
            
            if (!fs.existsSync(sessionPath)) {
                fs.mkdirSync(sessionPath, { recursive: true });
            }

            let chats = [];
            if (fs.existsSync(chatsPath)) {
                const chatsData = fs.readFileSync(chatsPath, 'utf8');
                chats = JSON.parse(chatsData);
            }

            // Buscar o crear chat
            let chat = chats.find(c => c.id === chatId);
            if (!chat) {
                chat = {
                    id: chatId,
                    name: chatId.split('@')[0],
                    messages: [],
                    lastMessage: message,
                    lastTimestamp: fullMessage.messageTimestamp || Date.now(),
                    unreadCount: 0
                };
                chats.push(chat);
            } else {
                chat.lastMessage = message;
                chat.lastTimestamp = fullMessage.messageTimestamp || Date.now();
                chat.unreadCount = (chat.unreadCount || 0) + 1;
            }

            // Guardar chat actualizado
            chat.messages.push({
                text: message,
                timestamp: fullMessage.messageTimestamp || Date.now(),
                fromMe: fullMessage.key.fromMe || false
            });

            // Mantener solo últimos 100 mensajes por chat
            if (chat.messages.length > 100) {
                chat.messages = chat.messages.slice(-100);
            }

            fs.writeFileSync(chatsPath, JSON.stringify(chats, null, 2));
        } catch (error) {
            console.error('Error guardando chat:', error);
        }
    }

    // Guardar mensajes salientes (cuando YO envío)
    async saveChatOutgoing(sessionId, chatId, message) {
        try {
            const chatsPath = path.join(__dirname, '../../../sessions', sessionId, 'chats.json');
            const sessionPath = path.join(__dirname, '../../../sessions', sessionId);
            
            if (!fs.existsSync(sessionPath)) {
                fs.mkdirSync(sessionPath, { recursive: true });
            }

            let chats = [];
            if (fs.existsSync(chatsPath)) {
                try {
                    const chatsData = fs.readFileSync(chatsPath, 'utf8');
                    chats = JSON.parse(chatsData);
                } catch (e) {
                    console.error('Error parseando chats.json:', e);
                    chats = [];
                }
            }

            // Buscar el chat existente por chatId
            let chat = chats.find(c => c.id === chatId);
            
            if (!chat) {
                // Crear nuevo chat
                const phoneNumber = chatId.split('@')[0];
                chat = {
                    id: chatId,
                    name: phoneNumber,
                    messages: [],
                    lastMessage: message,
                    lastTimestamp: Math.floor(Date.now() / 1000),
                    unreadCount: 0
                };
                chats.push(chat);
                console.log(`📝 Nuevo chat creado para ${phoneNumber}`);
            } else {
                // Actualizar chat existente
                chat.lastMessage = message;
                chat.lastTimestamp = Math.floor(Date.now() / 1000);
            }

            // Agregar mensaje al chat
            chat.messages.push({
                text: message,
                timestamp: Math.floor(Date.now() / 1000),
                fromMe: true  // ✅ IMPORTANTE: marcar como mensaje propio
            });

            // Mantener solo últimos 100 mensajes por chat
            if (chat.messages.length > 100) {
                chat.messages = chat.messages.slice(-100);
            }

            // Guardar archivo actualizado
            fs.writeFileSync(chatsPath, JSON.stringify(chats, null, 2));
            console.log(`✅ Chat guardado: ${chatId.split('@')[0]} - "${message.substring(0, 30)}..."`);
            
        } catch (error) {
            console.error('❌ Error guardando chat saliente:', error);
        }
    }
}

module.exports = WhatsAppServiceBaileys;

