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
        this.reconnectAttempts = new Map(); // sessionId -> número de intentos
        this.MAX_RECONNECT_ATTEMPTS = 5; // Máximo 5 intentos de reconexión
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
                        // Verificar intentos de reconexión
                        const attempts = (this.reconnectAttempts.get(sessionId) || 0) + 1;
                        this.reconnectAttempts.set(sessionId, attempts);
                        
                        if (attempts <= this.MAX_RECONNECT_ATTEMPTS) {
                            console.log(`🔄 Reintentando conexión (intento ${attempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
                            setTimeout(() => this.createSession(sessionId, userId, deviceId), 3000 * attempts); // Delay incremental
                        } else {
                            console.log(`⛔ Máximo de intentos alcanzado (${this.MAX_RECONNECT_ATTEMPTS}). Deteniendo reconexión.`);
                            this.reconnectAttempts.delete(sessionId);
                            this.clients.delete(sessionId);
                            this.authStates.delete(sessionId);
                            
                            await pool.execute(
                                'UPDATE dispositivos SET estado = ? WHERE session_id = ?',
                                ['desconectado', sessionId]
                            );
                            
                            // Notificar al frontend
                            this.io.emit(`device-connection-failed-${sessionId}`, {
                                sessionId,
                                message: 'No se pudo reconectar después de múltiples intentos. Por favor, reconecta el dispositivo manualmente.'
                            });
                        }
                    } else {
                        this.reconnectAttempts.delete(sessionId);
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
                    
                    // Resetear contador de intentos al conectar exitosamente
                    this.reconnectAttempts.delete(sessionId);
                    
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
                    
                    // 🔍 DEBUG COMPLETO - Mostrar toda la información del mensaje
                    console.log('\n📨 ========== MENSAJE RECIBIDO ==========');
                    console.log('Session:', sessionId);
                    console.log('Full message key:', JSON.stringify(msg.key, null, 2));
                    console.log('Push name:', msg.pushName);
                    
                    // ✅✅✅ SOLUCIÓN DEFINITIVA ✅✅✅
                    // Prioridad para obtener el número real:
                    // 1. remoteJidAlt (el número real cuando hay @lid)
                    // 2. participant (en grupos)
                    // 3. remoteJid (fallback)
                    
                    let rawJid;
                    if (msg.key.remoteJidAlt) {
                        // Si existe remoteJidAlt, ES EL NÚMERO REAL
                        rawJid = msg.key.remoteJidAlt;
                        console.log('✅ Usando remoteJidAlt (número real):', rawJid);
                    } else if (msg.key.participant) {
                        // En grupos, usar participant
                        rawJid = msg.key.participant;
                        console.log('📢 Usando participant (grupo):', rawJid);
                    } else {
                        // Fallback a remoteJid
                        rawJid = msg.key.remoteJid;
                        console.log('📱 Usando remoteJid (fallback):', rawJid);
                    }
                    
                    // Extraer número del JID
                    let phoneNumber = rawJid.split('@')[0];
                    
                    // Limpiar caracteres no numéricos
                    phoneNumber = phoneNumber.replace(/\D/g, '');
                    
                    console.log('📞 Número extraído:', phoneNumber);
                    
                    // Verificar que el número sea válido
                    if (phoneNumber.length > 15 || phoneNumber.length < 7) {
                        console.log('⚠️  Número parece inválido (length:', phoneNumber.length, ')');
                        // Último intento: usar remoteJid original
                        phoneNumber = msg.key.remoteJid.split('@')[0].replace(/\D/g, '');
                        console.log('🔄 Usando remoteJid como último recurso:', phoneNumber);
                    }
                    
                    // Reconstruir JID normalizado
                    const normalizedChatId = `${phoneNumber}@s.whatsapp.net`;
                    
                    const messageText = msg.message?.conversation || 
                                      msg.message?.extendedTextMessage?.text || 
                                      msg.message?.imageMessage?.caption ||
                                      'Mensaje multimedia';
                    
                    console.log('✅ JID normalizado final:', normalizedChatId);
                    console.log('💬 Texto del mensaje:', messageText.substring(0, 50));
                    console.log('==========================================\n');
                    
                    // Guardar chat con el ID NORMALIZADO
                    await this.saveChat(sessionId, normalizedChatId, messageText, msg);
                    
                    // Emitir nuevo mensaje al frontend con el ID normalizado
                    this.io.emit(`new-message-${sessionId}`, {
                        sessionId,
                        chatId: normalizedChatId,
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

    async sendMessage(sessionId, to, message, options = {}) {
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

            // 🤖 HUMANIZACIÓN: Comportamiento previo al envío
            if (options.humanize) {
                console.log(`🤖 Humanizando envío a ${cleanNumber}...`);
                
                // 1. Simular "lectura" del chat (delay aleatorio)
                await this.simulateReading(sock, jid);
                
                // 2. Simular "composing" (escribiendo...)
                await this.simulateTyping(sock, jid, message);
            }

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

    // ========== FUNCIONES DE HUMANIZACIÓN ==========

    /**
     * Simula que el usuario está "leyendo" el chat
     * @param {*} sock - Socket de WhatsApp
     * @param {string} jid - JID del destinatario
     */
    async simulateReading(sock, jid) {
        try {
            // Delay aleatorio de 1-3 segundos simulando lectura
            const readDelay = Math.floor(Math.random() * 2000) + 1000;
            console.log(`👀 Simulando lectura por ${readDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, readDelay));
            
            // Enviar "presencia" (online)
            await sock.sendPresenceUpdate('available', jid);
        } catch (error) {
            console.error('Error simulando lectura:', error);
        }
    }

    /**
     * Simula que el usuario está escribiendo
     * @param {*} sock - Socket de WhatsApp
     * @param {string} jid - JID del destinatario
     * @param {string} message - Mensaje a enviar (para calcular tiempo de tipeo)
     */
    async simulateTyping(sock, jid, message) {
        try {
            // Calcular tiempo de tipeo basado en longitud del mensaje
            // Velocidad promedio humana: ~40 palabras por minuto = ~200 caracteres por minuto
            // = ~3.3 caracteres por segundo
            const charsPerSecond = 3 + Math.random() * 2; // 3-5 chars/segundo (variación humana)
            const typingTime = Math.min((message.length / charsPerSecond) * 1000, 15000); // Máximo 15 segundos
            
            console.log(`⌨️  Simulando escritura por ${Math.round(typingTime)}ms...`);
            
            // Enviar "composing" (escribiendo...)
            await sock.sendPresenceUpdate('composing', jid);
            
            // Esperar el tiempo de tipeo
            await new Promise(resolve => setTimeout(resolve, typingTime));
            
            // Volver a "paused" antes de enviar
            await sock.sendPresenceUpdate('paused', jid);
            
            // Mini pausa antes de enviar (humano presiona "enviar")
            await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
        } catch (error) {
            console.error('Error simulando tipeo:', error);
        }
    }

    /**
     * Conversa con Meta AI (WhatsApp AI) para parecer más humano
     * @param {*} sock - Socket de WhatsApp
     * @param {string} sessionId - ID de sesión
     */
    async chatWithMetaAI(sock, sessionId) {
        try {
            // JID de Meta AI (WhatsApp AI)
            const metaAIJid = '447860099299@s.whatsapp.net'; // Número oficial de Meta AI
            
            // Preguntas casuales para parecer humano
            const casualQuestions = [
                '¿Qué hora es?',
                'Cuéntame un chiste',
                '¿Cómo está el clima?',
                'Dame un consejo',
                '¿Qué recomiendas hacer hoy?',
                'Escribe algo motivacional',
                '¿Alguna curiosidad interesante?'
            ];
            
            const randomQuestion = casualQuestions[Math.floor(Math.random() * casualQuestions.length)];
            
            console.log(`🤖 Conversando con Meta AI: "${randomQuestion}"`);
            
            // Simular lectura
            await this.simulateReading(sock, metaAIJid);
            
            // Simular tipeo
            await this.simulateTyping(sock, metaAIJid, randomQuestion);
            
            // Enviar mensaje a Meta AI
            await sock.sendMessage(metaAIJid, { text: randomQuestion });
            
            console.log(`✅ Mensaje enviado a Meta AI desde ${sessionId}`);
            
            // Esperar respuesta (delay aleatorio 3-8 segundos)
            const waitTime = 3000 + Math.random() * 5000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
        } catch (error) {
            console.error('❌ Error conversando con Meta AI:', error);
            // No lanzar error, continuar con el envío normal
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
                try {
                    const chatsData = fs.readFileSync(chatsPath, 'utf8');
                    chats = JSON.parse(chatsData);
                } catch (e) {
                    console.error('Error parseando chats.json:', e);
                    chats = [];
                }
            }

            // Extraer número del chatId
            const phoneNumber = chatId.split('@')[0].replace(/\D/g, '');

            // ✅ BUSCAR CHAT EXISTENTE POR NÚMERO (no por ID exacto)
            // Esto evita crear chats duplicados si el JID varía
            let chat = chats.find(c => {
                const existingPhone = c.id.split('@')[0].replace(/\D/g, '');
                return existingPhone === phoneNumber;
            });

            if (!chat) {
                // Crear nuevo chat con ID normalizado
                chat = {
                    id: chatId,  // Ya viene normalizado del evento
                    name: phoneNumber,
                    messages: [],
                    lastMessage: message,
                    lastTimestamp: fullMessage.messageTimestamp || Date.now(),
                    unreadCount: 0
                };
                chats.push(chat);
                console.log(`📝 Nuevo chat creado: ${phoneNumber} (JID: ${chatId})`);
            } else {
                // Actualizar chat existente
                // ✅ Actualizar el ID al normalizado si era diferente
                if (chat.id !== chatId) {
                    console.log(`🔄 Actualizando JID: ${chat.id} → ${chatId}`);
                    chat.id = chatId;
                }
                chat.lastMessage = message;
                chat.lastTimestamp = fullMessage.messageTimestamp || Date.now();
                chat.unreadCount = (chat.unreadCount || 0) + 1;
            }

            // Guardar mensaje
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
            console.log(`✅ Mensaje guardado en chat: ${phoneNumber}`);
            
        } catch (error) {
            console.error('❌ Error guardando chat:', error);
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

            // Extraer número del chatId
            const phoneNumber = chatId.split('@')[0].replace(/\D/g, '');

            // ✅ BUSCAR CHAT EXISTENTE POR NÚMERO (no por ID exacto)
            let chat = chats.find(c => {
                const existingPhone = c.id.split('@')[0].replace(/\D/g, '');
                return existingPhone === phoneNumber;
            });
            
            if (!chat) {
                // Crear nuevo chat con ID normalizado
                chat = {
                    id: chatId,  // Ya viene normalizado
                    name: phoneNumber,
                    messages: [],
                    lastMessage: message,
                    lastTimestamp: Math.floor(Date.now() / 1000),
                    unreadCount: 0
                };
                chats.push(chat);
                console.log(`📝 Nuevo chat creado para ${phoneNumber} (JID: ${chatId})`);
            } else {
                // Actualizar chat existente
                // ✅ Actualizar el ID al normalizado si era diferente
                if (chat.id !== chatId) {
                    console.log(`🔄 Actualizando JID saliente: ${chat.id} → ${chatId}`);
                    chat.id = chatId;
                }
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
            console.log(`✅ Chat guardado: ${phoneNumber} - "${message.substring(0, 30)}..."`);
            
        } catch (error) {
            console.error('❌ Error guardando chat saliente:', error);
        }
    }
}

module.exports = WhatsAppServiceBaileys;

