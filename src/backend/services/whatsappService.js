const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { pool } = require('../../config/database');
const { redisHelper } = require('../../config/redis');

// Almacenar clientes de WhatsApp activos
const clients = new Map();

class WhatsAppService {
    constructor(io) {
        this.io = io;
    }

    // Crear nueva sesión de WhatsApp
    async createSession(sessionId, userId, deviceId) {
        try {
            if (clients.has(sessionId)) {
                console.log(`Sesión ${sessionId} ya existe`);
                return clients.get(sessionId);
            }

            console.log(`🔧 Iniciando creación de cliente WhatsApp para session: ${sessionId}`);

            const sessionPath = path.join(__dirname, '../../../sessions', sessionId);
            
            // Crear directorio de sesión si no existe
            if (!fs.existsSync(sessionPath)) {
                fs.mkdirSync(sessionPath, { recursive: true });
            }

            // Crear cliente de WhatsApp - configurar Puppeteer de forma segura
            console.log(`🧩 Creando cliente WhatsApp para ${sessionId}...`);

            // Intentar localizar instalación local de Chrome (Windows comunes)
            const possibleChromePaths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
            ];
            const chromePath = possibleChromePaths.find(p => fs.existsSync(p));
            if (chromePath) console.log(`🔎 Usando Chrome en: ${chromePath}`);
            else console.log('⚠️ Chrome no encontrado en rutas estándar. Usando Chromium embebido por Puppeteer.');

            const puppeteerOptions = {
                headless: true,  // PROBAR EN HEADLESS
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    `--user-data-dir=${sessionPath}`,  // User data en la carpeta de sesión
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-site-isolation-trials'
                ],
                ignoreHTTPSErrors: true
            };

            if (chromePath) {
                puppeteerOptions.executablePath = chromePath;
            }

            const client = new Client({
                authStrategy: new LocalAuth({
                    clientId: sessionId,
                    dataPath: sessionPath
                }),
                puppeteer: puppeteerOptions,
                webVersionCache: {
                    type: 'remote',
                    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
                    strict: false
                }
            });

            console.log(`✅ Cliente creado, preparando para inicializar...`);
            
            // INYECTAR CÓDIGO PARA DESHABILITAR SERVICE WORKERS ANTES DE LA CARGA
            client.on('remote_session_saved', async () => {
                console.log('📄 Sesión guardada remotamente');
            });

            // Timeout de inicialización: 120 segundos
            const initTimeout = setTimeout(() => {
                console.error(`⏱️ TIMEOUT: Cliente ${sessionId} no generó QR en 120 segundos`);
                try { client.destroy(); } catch (e) { console.error('Error destruyendo cliente por timeout:', e); }
            }, 120000);

            // Eventos del cliente
            client.on('qr', async (qr) => {
                clearTimeout(initTimeout);
                
                console.log(`\n🎯🎯🎯 ¡¡¡QR GENERADO!!! 🎯🎯🎯`);
                console.log(`   Sesión: ${sessionId}`);
                console.log(`   QR: ${qr.substring(0, 30)}...`);
                
                try {
                    const qrImage = await qrcode.toDataURL(qr);
                    console.log(`   ✅ Imagen: ${qrImage.length} chars`);
                    
                    await pool.execute(
                        'UPDATE dispositivos SET estado = ? WHERE session_id = ?',
                        ['esperando_qr', sessionId]
                    );
                    console.log(`   ✅ BD OK`);

                    console.log(`   📡 Emitiendo qr-${sessionId}...`);
                    this.io.emit(`qr-${sessionId}`, {
                        sessionId,
                        qr: qrImage
                    });
                    console.log(`   ✅✅✅ EMITIDO! ✅✅✅\n`);

                    await redisHelper.setCache(`qr:${sessionId}`, qrImage, 120);
                } catch (error) {
                    console.error(`   ❌ ERROR:`, error);
                }
            });

            client.on('ready', async () => {
                console.log(`✓ Cliente ${sessionId} está listo`);
                
                const phoneNumber = client.info.wid.user;

                // Actualizar estado en BD
                await pool.execute(
                    'UPDATE dispositivos SET estado = ?, numero_telefono = ?, ultima_conexion = NOW() WHERE session_id = ?',
                    ['conectado', phoneNumber, sessionId]
                );

                // Guardar sesión en Redis
                await redisHelper.saveSession(sessionId, {
                    userId,
                    deviceId,
                    phoneNumber,
                    connected: true,
                    connectedAt: new Date().toISOString()
                });

                this.io.emit(`ready-${sessionId}`, {
                    sessionId,
                    phoneNumber,
                    status: 'conectado'
                });
            });

            client.on('authenticated', () => {
                console.log(`✓ Cliente ${sessionId} autenticado`);
                this.io.emit(`authenticated-${sessionId}`, { sessionId });
            });

            client.on('auth_failure', async (msg) => {
                console.error(`✗ Fallo de autenticación ${sessionId}:`, msg);
                
                await pool.execute(
                    'UPDATE dispositivos SET estado = ? WHERE session_id = ?',
                    ['error', sessionId]
                );

                this.io.emit(`auth_failure-${sessionId}`, {
                    sessionId,
                    error: msg
                });
            });

            client.on('disconnected', async (reason) => {
                console.log(`Dispositivo ${sessionId} desconectado:`, reason);
                
                await pool.execute(
                    'UPDATE dispositivos SET estado = ? WHERE session_id = ?',
                    ['desconectado', sessionId]
                );

                await redisHelper.deleteSession(sessionId);
                clients.delete(sessionId);

                this.io.emit(`disconnected-${sessionId}`, {
                    sessionId,
                    reason
                });
            });

            client.on('message', async (message) => {
                // Manejar mensajes entrantes
                this.handleIncomingMessage(sessionId, message);
            });

            // Inicializar cliente
            try {
                await client.initialize();
                console.log(`🚀 Cliente inicializado correctamente para session: ${sessionId}`);
            } catch (initErr) {
                console.error(`❌ Error inicializando cliente para session ${sessionId}:`, initErr);
                throw initErr;
            }

            // Guardar cliente
            clients.set(sessionId, client);

            return client;

        } catch (error) {
            console.error(`Error creando sesión ${sessionId}:`, error);
            throw error;
        }
    }

    // Obtener cliente existente
    getClient(sessionId) {
        return clients.get(sessionId);
    }

    // Verificar si cliente está conectado
    isClientReady(sessionId) {
        const client = clients.get(sessionId);
        return client ? true : false;
    }

    // Enviar mensaje
    async sendMessage(sessionId, phoneNumber, message) {
        try {
            const client = this.getClient(sessionId);
            
            if (!client) {
                throw new Error('Cliente no encontrado o no conectado');
            }

            // Formatear número
            const chatId = this.formatPhoneNumber(phoneNumber);
            
            // Enviar mensaje
            await client.sendMessage(chatId, message);
            
            return { success: true };

        } catch (error) {
            console.error(`Error enviando mensaje:`, error);
            throw error;
        }
    }

    // Enviar mensaje con imagen
    async sendMessageWithImage(sessionId, phoneNumber, message, imagePath) {
        try {
            const client = this.getClient(sessionId);
            
            if (!client) {
                throw new Error('Cliente no encontrado o no conectado');
            }

            // Formatear número
            const chatId = this.formatPhoneNumber(phoneNumber);
            
            // Verificar si la ruta es absoluta o relativa
            let fullImagePath = imagePath;
            if (!path.isAbsolute(imagePath)) {
                // Si es relativa, asumimos que está en la carpeta uploads del proyecto
                fullImagePath = path.join(__dirname, '../../../uploads', imagePath);
            }

            // Verificar que el archivo exista
            if (!fs.existsSync(fullImagePath)) {
                console.error(`❌ Imagen no encontrada: ${fullImagePath}`);
                throw new Error(`Imagen no encontrada: ${fullImagePath}`);
            }

            // Importar MessageMedia de whatsapp-web.js
            const { MessageMedia } = require('whatsapp-web.js');

            // Crear objeto de media desde archivo
            const media = MessageMedia.fromFilePath(fullImagePath);
            
            // Enviar mensaje con imagen
            await client.sendMessage(chatId, media, { caption: message });
            
            console.log(`✅ Imagen enviada: ${fullImagePath}`);
            return { success: true };

        } catch (error) {
            console.error(`Error enviando mensaje con imagen:`, error);
            throw error;
        }
    }

    // Formatear número de teléfono
    formatPhoneNumber(phone) {
        // Remover caracteres no numéricos
        let cleaned = phone.replace(/\D/g, '');
        
        const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE ? process.env.DEFAULT_COUNTRY_CODE.replace(/\D/g, '') : null;

        if (defaultCountryCode && !cleaned.startsWith(defaultCountryCode) && cleaned.length <= 9) {
            cleaned = `${defaultCountryCode}${cleaned}`;
        }
        
        return cleaned + '@c.us';
    }

    // Manejar mensajes entrantes
    async handleIncomingMessage(sessionId, message) {
        try {
            const contact = await message.getContact();
            const chat = await message.getChat();

            // Guardar mensaje en base de datos
            // Esto se puede expandir según necesidades

            // Emitir mensaje a frontend
            this.io.emit(`message-${sessionId}`, {
                sessionId,
                from: contact.number,
                fromName: contact.pushname || contact.number,
                body: message.body,
                timestamp: message.timestamp,
                hasMedia: message.hasMedia
            });

        } catch (error) {
            console.error('Error manejando mensaje entrante:', error);
        }
    }

    // Obtener chats
    async getChats(sessionId) {
        try {
            const client = this.getClient(sessionId);
            
            if (!client) {
                throw new Error('Cliente no encontrado');
            }

            const chats = await client.getChats();
            
            return chats.map(chat => ({
                id: chat.id._serialized,
                name: chat.name,
                isGroup: chat.isGroup,
                unreadCount: chat.unreadCount,
                lastMessage: chat.lastMessage ? {
                    body: chat.lastMessage.body,
                    timestamp: chat.lastMessage.timestamp
                } : null
            }));

        } catch (error) {
            console.error('Error obteniendo chats:', error);
            throw error;
        }
    }

    // Obtener mensajes de un chat
    async getChatMessages(sessionId, chatId, limit = 50) {
        try {
            const client = this.getClient(sessionId);
            
            if (!client) {
                throw new Error('Cliente no encontrado');
            }

            const chat = await client.getChatById(chatId);
            const messages = await chat.fetchMessages({ limit });
            
            return messages.map(msg => ({
                id: msg.id._serialized,
                body: msg.body,
                from: msg.from,
                to: msg.to,
                timestamp: msg.timestamp,
                fromMe: msg.fromMe,
                hasMedia: msg.hasMedia
            }));

        } catch (error) {
            console.error('Error obteniendo mensajes:', error);
            throw error;
        }
    }

    // Cerrar sesión
    async destroySession(sessionId) {
        try {
            const client = this.getClient(sessionId);
            
            if (client) {
                await client.destroy();
                clients.delete(sessionId);
                await redisHelper.deleteSession(sessionId);
            }

            await pool.execute(
                'UPDATE dispositivos SET estado = ? WHERE session_id = ?',
                ['desconectado', sessionId]
            );

            return { success: true };

        } catch (error) {
            console.error('Error destruyendo sesión:', error);
            throw error;
        }
    }

    // Obtener todos los clientes activos
    getAllClients() {
        return Array.from(clients.keys());
    }

    // Agregar contacto
    async addContact(sessionId, phoneNumber, name) {
        try {
            const client = this.getClient(sessionId);
            
            if (!client) {
                throw new Error('Cliente no encontrado');
            }

            const chatId = this.formatPhoneNumber(phoneNumber);
            
            // Enviar mensaje inicial invisible o simplemente guardar contacto
            // WhatsApp Web no tiene API directa para agregar contactos sin interacción
            
            return { success: true, chatId };

        } catch (error) {
            console.error('Error agregando contacto:', error);
            throw error;
        }
    }
}

module.exports = WhatsAppService;

