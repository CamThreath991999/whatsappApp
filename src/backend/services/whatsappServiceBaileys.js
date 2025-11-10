/**
 * Servicio de WhatsApp usando Baileys (sin Puppeteer)
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { pool } = require('../../config/database');
const redisHelper = require('../utils/redisHelper');
const {
    ensureProspectSchema,
    getProspectByButtonId,
    getOrCreateCategory,
    upsertContactFromProspect,
    updateProspectResponse,
    markFollowupSent,
    incrementCampaignCounter
} = require('./prospectService');

class WhatsAppServiceBaileys {
    constructor(io, campaignService = null) {
        this.io = io;
        this.campaignService = campaignService; // Referencia opcional al campaignService
        this.clients = new Map(); // sessionId -> socket
        this.authStates = new Map(); // sessionId -> authState
        this.reconnectAttempts = new Map(); // sessionId -> número de intentos
        this.MAX_RECONNECT_ATTEMPTS = 5; // Máximo 5 intentos de reconexión
    }

    // Método para establecer referencia al campaignService
    setCampaignService(campaignService) {
        this.campaignService = campaignService;
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
                    
                    // Obtener deviceId desde la BD
                    const [deviceInfo] = await pool.execute(
                        'SELECT id FROM dispositivos WHERE session_id = ?',
                        [sessionId]
                    );

                    if (deviceInfo.length > 0) {
                        const deviceId = deviceInfo[0].id;
                        
                        await pool.execute(
                            'UPDATE dispositivos SET estado = ?, numero_telefono = ? WHERE session_id = ?',
                            ['conectado', phoneNumber, sessionId]
                        );

                        this.io.emit(`authenticated-${sessionId}`, {
                            sessionId,
                            phoneNumber,
                            deviceId
                        });

                        // 🔥 NUEVO: Notificar al campaignService para redistribución automática
                        if (this.campaignService) {
                            // Esperar un pequeño delay para asegurar que la BD está actualizada
                            setTimeout(async () => {
                                try {
                                    await this.campaignService.handleNewDeviceConnected(deviceId);
                                } catch (error) {
                                    console.error('Error en redistribución automática:', error);
                                }
                            }, 2000);
                        }
                    } else {
                        await pool.execute(
                            'UPDATE dispositivos SET estado = ?, numero_telefono = ? WHERE session_id = ?',
                            ['conectado', phoneNumber, sessionId]
                        );

                        this.io.emit(`authenticated-${sessionId}`, {
                            sessionId,
                            phoneNumber
                        });
                    }
                }
            });

            // Recibos de lectura/entrega
            sock.ev.on('message-receipt.update', async (updates) => {
                try {
                    for (const u of updates) {
                        const chatId = u.key?.remoteJid;
                        const messageId = u.key?.id;
                        if (!chatId || !messageId) continue;

                        // Tipo de recibo (read/delivery)
                        const isRead = (u.readTimestamp && Number(u.readTimestamp) > 0) || u.receipt === 'read';
                        const newStatus = isRead ? 'read' : 'delivered';
                        await this.updateMessageStatus(null, chatId, messageId, newStatus);
                    }
                } catch (e) {
                    console.error('Error actualizando recibos:', e.message);
                }
            });

            // Algunas versiones notifican por messages.update
            sock.ev.on('messages.update', async (updates) => {
                try {
                    for (const u of updates) {
                        const chatId = u.key?.remoteJid;
                        const messageId = u.key?.id;
                        if (!chatId || !messageId) continue;
                        if (u.update && u.update.status) {
                            const status = u.update.status === 'READ' ? 'read' : (u.update.status === 'DELIVERY_ACK' ? 'delivered' : undefined);
                            if (status) await this.updateMessageStatus(null, chatId, messageId, status);
                        }
                    }
                } catch (e) {
                    console.error('messages.update error:', e.message);
                }
            });

            // Evento: Recibir mensajes
            sock.ev.on('messages.upsert', async ({ messages, type }) => {
                for (const msg of messages) {
                    if (msg.key.fromMe) continue; // Ignorar mensajes propios
 
                    let buttonInfo = null;

                    if (msg.message?.buttonsResponseMessage || msg.message?.interactiveResponseMessage) {
                        buttonInfo = await this.processProspectButtonResponse(sessionId, msg);
                        if (buttonInfo && buttonInfo.label) {
                            msg.message = msg.message || {};
                            msg.message.conversation = buttonInfo.label;
                        }
                    }

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

            const sent = await sock.sendMessage(jid, { text: message });
            console.log(`✅ Mensaje enviado a ${cleanNumber} (JID: ${jid}) desde ${sessionId}`);

            // Guardar el mensaje saliente con id para recibos
            await this.saveChatOutgoing(
                sessionId,
                jid,
                message,
                sent?.key?.id || null,
                'sent',
                options?.displayName || null
            );

            return { success: true };
        } catch (error) {
            console.error(`❌ Error enviando mensaje:`, error);
            throw error;
        }
    }

    // Enviar mensaje con botones interactivos
    async sendButtonMessage(sessionId, to, message, buttons = [], footer = 'Selecciona una opción', options = {}) {
        try {
            const sock = this.clients.get(sessionId);
            if (!sock) {
                throw new Error(`Sesión ${sessionId} no encontrada`);
            }

            const cleanNumber = to.toString().replace(/\D/g, '');
            const jid = to.includes('@s.whatsapp.net') ? to : `${cleanNumber}@s.whatsapp.net`;

            const cleanedButtons = Array.isArray(buttons) ? buttons : [];

            const validButtons = cleanedButtons
                .map((btn, index) => {
                    const label = (btn?.text || '').toString().trim();
                    if (!label) return null;
                    const id = (btn?.id || `btn-${Date.now()}-${index}`)
                        .toString()
                        .trim()
                        .slice(0, 128);

                    return {
                        id,
                        text: label
                    };
                })
                .filter(Boolean)
                .slice(0, 3);

            if (validButtons.length === 0) {
                // Si no hay botones válidos, enviar texto normal
                return await this.sendMessage(sessionId, to, message, { humanize: true });
            }

            // Humanización básica antes de enviar botones
            await this.simulateReading(sock, jid);
            await this.simulateTyping(sock, jid, message);

            const messageText = (message && message.trim()) ? message.trim() : 'Selecciona una opción:';

            const templateButtons = validButtons.map((btn, index) => ({
                index: index + 1,
                quickReplyButton: {
                    displayText: btn.text,
                    id: btn.id
                }
            }));

            const payload = {
                text: messageText,
                footer: footer || undefined,
                templateButtons
            };

            const sent = await sock.sendMessage(jid, payload);
            console.log(`✅ Mensaje con botones enviado a ${cleanNumber} (JID: ${jid}) desde ${sessionId}`);

            await this.saveChatOutgoing(
                sessionId,
                jid,
                payload.text,
                sent?.key?.id || null,
                'sent',
                options?.displayName || null
            );

            return { success: true, messageId: sent?.key?.id || null };
        } catch (error) {
            console.error('❌ Error enviando mensaje con botones:', error);
            throw error;
        }
    }

    // Enviar mensaje con imagen
    async sendMessageWithImage(sessionId, to, message, imagePath, options = {}) {
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
            
            const sent = await sock.sendMessage(jid, {
                image: imageBuffer,
                caption: message
            });

            console.log(`✅ Imagen enviada a ${cleanNumber} (JID: ${jid}) desde ${sessionId}`);

            // Guardar el mensaje saliente en chats.json (con media)
            await this.saveChatOutgoingMedia(sessionId, jid, {
                text: message,
                mediaUrl: `/uploads/${path.basename(fullImagePath)}`,
                mediaType: 'image',
                fileName: path.basename(fullImagePath),
                messageId: sent?.key?.id || null,
                status: 'sent',
                displayName: options?.displayName || null
            });

            return { success: true };
        } catch (error) {
            console.error(`❌ Error enviando mensaje con imagen:`, error);
            throw error;
        }
    }

    // Enviar documento (PDF u otros)
    async sendDocument(sessionId, to, filePath, fileName, mimeType) {
        try {
            const sock = this.clients.get(sessionId);
            if (!sock) {
                throw new Error(`Sesión ${sessionId} no encontrada`);
            }

            // Normalizar número
            let cleanNumber = to.toString().replace(/\D/g, '');
            const jid = to.includes('@s.whatsapp.net') ? to : `${cleanNumber}@s.whatsapp.net`;

            // Resolver ruta absoluta
            let fullPath = filePath;
            if (!path.isAbsolute(filePath)) {
                fullPath = path.join(__dirname, '../../../uploads', filePath);
            }
            if (!fs.existsSync(fullPath)) {
                throw new Error('Archivo no encontrado');
            }

            const buffer = fs.readFileSync(fullPath);
            const sent = await sock.sendMessage(jid, {
                document: buffer,
                mimetype: mimeType || 'application/pdf',
                fileName: fileName || path.basename(fullPath)
            });

            console.log(`✅ Documento enviado a ${cleanNumber} (${fileName})`);
            // Guardar salida con media
            await this.saveChatOutgoingMedia(sessionId, jid, {
                text: fileName,
                mediaUrl: `/uploads/${path.basename(fullPath)}`,
                mediaType: mimeType || 'application/pdf',
                fileName: fileName || path.basename(fullPath),
                messageId: sent?.key?.id || null,
                status: 'sent'
            });
            return { success: true };
        } catch (error) {
            console.error('❌ Error enviando documento:', error);
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

            const pushName = fullMessage?.pushName ? fullMessage.pushName.trim() : null;

            if (!chat) {
                // Crear nuevo chat con ID normalizado
                chat = {
                    id: chatId,  // Ya viene normalizado del evento
                    name: pushName || phoneNumber,
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
                if (pushName && pushName.length > 0) {
                    chat.name = pushName;
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
    async saveChatOutgoing(sessionId, chatId, message, messageId = null, status = 'sent', displayName = null) {
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
                    name: displayName || phoneNumber,
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
                if (displayName && displayName.trim().length > 0) {
                    chat.name = displayName.trim();
                }
                chat.lastMessage = message;
                chat.lastTimestamp = Math.floor(Date.now() / 1000);
            }

            // Agregar mensaje al chat
            chat.messages.push({
                text: message,
                timestamp: Math.floor(Date.now() / 1000),
                fromMe: true,  // ✅ IMPORTANTE: marcar como mensaje propio
                messageId: messageId || undefined,
                status
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

    // Guardar mensaje saliente con media
    async saveChatOutgoingMedia(sessionId, chatId, { text, mediaUrl, mediaType, fileName, messageId = null, status = 'sent', displayName = null }) {
        try {
            const chatsPath = path.join(__dirname, '../../../sessions', sessionId, 'chats.json');
            const sessionPath = path.join(__dirname, '../../../sessions', sessionId);
            if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

            let chats = [];
            if (fs.existsSync(chatsPath)) {
                try { chats = JSON.parse(fs.readFileSync(chatsPath, 'utf8')); } catch { chats = []; }
            }

            const phoneNumber = chatId.split('@')[0].replace(/\D/g, '');
            let chat = chats.find(c => c.id.split('@')[0].replace(/\D/g, '') === phoneNumber);
            if (!chat) {
                chat = { id: chatId, name: displayName || phoneNumber, messages: [], lastMessage: '', lastTimestamp: Math.floor(Date.now()/1000), unreadCount: 0 };
                chats.push(chat);
            }

            const now = Math.floor(Date.now()/1000);
            chat.lastMessage = text || (mediaType?.startsWith('image') ? '📷 Imagen' : '📎 Archivo');
            chat.lastTimestamp = now;
            if (displayName && displayName.trim().length > 0) {
                chat.name = displayName.trim();
            }

            chat.messages.push({
                text: text || '',
                timestamp: now,
                fromMe: true,
                mediaUrl: mediaUrl || null,
                mediaType: mediaType || null,
                fileName: fileName || null,
                messageId: messageId || undefined,
                status
            });

            if (chat.messages.length > 100) chat.messages = chat.messages.slice(-100);
            fs.writeFileSync(chatsPath, JSON.stringify(chats, null, 2));
        } catch (error) {
            console.error('❌ Error guardando chat saliente (media):', error);
        }
    }

    // Actualizar estado de un mensaje por messageId
    async updateMessageStatus(sessionId, chatId, messageId, status) {
        try {
            if (!chatId || !messageId) return;
            const sessionIds = sessionId ? [sessionId] : Array.from(this.clients.keys());
            for (const sid of sessionIds) {
                const chatsPath = path.join(__dirname, '../../../sessions', sid, 'chats.json');
                if (!fs.existsSync(chatsPath)) continue;
                let updated = false;
                const chats = JSON.parse(fs.readFileSync(chatsPath, 'utf8'));
                const chat = chats.find(c => c.id === chatId);
                if (!chat || !chat.messages) continue;
                chat.messages.forEach(m => {
                    if (m.messageId === messageId && m.fromMe) {
                        m.status = status;
                        updated = true;
                    }
                });
                if (updated) {
                    fs.writeFileSync(chatsPath, JSON.stringify(chats, null, 2));
                    break;
                }
            }
        } catch (e) {
            console.error('Error updateMessageStatus:', e.message);
        }
    }

    async processProspectButtonResponse(sessionId, msg) {
        try {
            const buttonResponse = msg.message?.buttonsResponseMessage || msg.message?.interactiveResponseMessage?.buttonReply;

            if (!buttonResponse) {
                return null;
            }

            const buttonId = buttonResponse.selectedButtonId || buttonResponse.id;
            const buttonLabel = buttonResponse.selectedDisplayText || buttonResponse.displayText || buttonResponse?.title || buttonResponse?.buttonText?.displayText || buttonResponse?.text || null;

            if (!buttonId || !buttonId.startsWith('prospect:')) {
                return { handled: false, label: buttonLabel };
            }

            await ensureProspectSchema();
            const prospect = await getProspectByButtonId(buttonId);

            if (!prospect) {
                console.warn(`⚠️ Prospecto no encontrado para botón ${buttonId}`);
                return { handled: false, label: buttonLabel };
            }

            if (prospect.estado !== 'pendiente') {
                console.log(`ℹ️ Prospecto ${prospect.id} ya procesado (${prospect.estado}).`);
                return { handled: true, label: buttonLabel || prospect.estado };
            }

            const isAccept = buttonId.endsWith(':accept');
            const nuevoEstado = isAccept ? 'aceptado' : 'rechazado';

            const categoriaId = await getOrCreateCategory(prospect.usuario_id, prospect.categoria);
            const contactoId = await upsertContactFromProspect({
                usuarioId: prospect.usuario_id,
                telefono: prospect.telefono,
                nombre: prospect.nombre,
                categoriaId,
                estado: nuevoEstado,
                prospectId: prospect.id
            });

            await updateProspectResponse({
                prospectId: prospect.id,
                estado: nuevoEstado,
                contactoId
            });

            const metadata = (() => {
                if (!prospect.metadata) return null;
                try {
                    if (typeof prospect.metadata === 'string') {
                        return JSON.parse(prospect.metadata);
                    }
                    return prospect.metadata;
                } catch (err) {
                    console.log('Error parseando metadata de prospecto:', err);
                    return null;
                }
            })();

            if (isAccept && prospect.mensaje_original && !prospect.followup_sent) {
                try {
                    const displayName = prospect.nombre ? prospect.nombre : null;
                    if (metadata && metadata.hasFile && metadata.filePath) {
                        await this.sendMessageWithImage(
                            sessionId,
                            prospect.telefono,
                            prospect.mensaje_original,
                            metadata.filePath,
                            { displayName }
                        );
                    } else {
                        await this.sendMessage(
                            sessionId,
                            prospect.telefono,
                            prospect.mensaje_original,
                            { humanize: true, displayName }
                        );
                    }
                    await markFollowupSent(prospect.id);
                    await incrementCampaignCounter(prospect.campana_id, 'enviados');
                } catch (sendError) {
                    console.error('Error enviando mensaje posterior a aceptación:', sendError);
                }
            }

            if (!isAccept) {
                await incrementCampaignCounter(prospect.campana_id, 'fallidos');
            }

            this.io.emit(`prospect-response-${prospect.campana_id}`, {
                prospectId: prospect.id,
                telefono: prospect.telefono,
                estado: nuevoEstado,
                contactoId,
                campanaId: prospect.campana_id
            });

            return { handled: true, label: buttonLabel || (isAccept ? 'ACEPTAR' : 'RECHAZAR') };
        } catch (error) {
            console.error('❌ Error procesando respuesta de prospecto:', error);
            return { handled: false, label: null, error: error.message };
        }
    }

    // Resolver sessionId por chatId (búsqueda simple en memoria)
    _resolveSessionIdByChat(chatId) {
        for (const [sessionId, sock] of this.clients.entries()) {
            // Heurística: si existe, devolvemos el primero; opcionalmente mejorar
            return sessionId;
        }
        return null;
    }
}

module.exports = WhatsAppServiceBaileys;

