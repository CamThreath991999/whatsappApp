const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');
const { verifyToken } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Obtener chats del usuario desde sessions/*/chats.json
router.get('/', verifyToken, async (req, res) => {
    try {
        const { dispositivo_id, campaign_only } = req.query;

        // Obtener dispositivos del usuario
        let deviceQuery = 'SELECT * FROM dispositivos WHERE usuario_id = ?';
        const deviceParams = [req.user.id];

        if (dispositivo_id) {
            deviceQuery += ' AND id = ?';
            deviceParams.push(dispositivo_id);
        }

        const [devices] = await pool.execute(deviceQuery, deviceParams);

        // Si se solicita solo chats de campañas, obtener números de contactos en campañas
        let campaignPhones = new Set();
        if (campaign_only === 'true' || campaign_only === '1') {
            const [campaignContacts] = await pool.execute(
                `SELECT DISTINCT c.telefono 
                 FROM contactos c
                 INNER JOIN mensajes m ON c.id = m.contacto_id
                 INNER JOIN campanas camp ON m.campana_id = camp.id
                 WHERE camp.usuario_id = ?`,
                [req.user.id]
            );
            
            // Guardar teléfonos en Set para búsqueda rápida
            campaignContacts.forEach(contact => {
                // Limpiar el número (sin espacios, guiones, etc.)
                const cleanPhone = contact.telefono.toString().replace(/\D/g, '');
                campaignPhones.add(cleanPhone);
            });
            
            console.log(`📊 Filtrando solo ${campaignPhones.size} contactos de campañas`);
        }

        // Leer chats.json de cada dispositivo
        const allChats = [];

        for (const device of devices) {
            if (!device.session_id) continue;

            const chatsPath = path.join(__dirname, '../../../sessions', device.session_id, 'chats.json');

            if (fs.existsSync(chatsPath)) {
                try {
                    const chatsData = fs.readFileSync(chatsPath, 'utf8');
                    const chats = JSON.parse(chatsData);

                    // Filtrar chats si campaign_only está activo
                    let filteredChats = chats;
                    if (campaignPhones.size > 0) {
                        filteredChats = chats.filter(chat => {
                            // Extraer número del chatId (formato: 51900124654@s.whatsapp.net)
                            const chatPhone = chat.id.split('@')[0];
                            const cleanChatPhone = chatPhone.replace(/\D/g, '');
                            return campaignPhones.has(cleanChatPhone);
                        });
                    }

                    // Agregar info del dispositivo
                    filteredChats.forEach(chat => {
                        chat.deviceName = device.nombre;
                        chat.deviceId = device.id;
                        chat.sessionId = device.session_id;
                    });

                    allChats.push(...filteredChats);
                } catch (err) {
                    console.error(`Error leyendo chats de ${device.session_id}:`, err);
                }
            }
        }

        // Ordenar por última marca de tiempo
        allChats.sort((a, b) => b.lastTimestamp - a.lastTimestamp);

        res.json({
            success: true,
            chats: allChats,
            totalDevices: devices.length,
            campaignFilter: campaign_only === 'true' || campaign_only === '1'
        });

    } catch (error) {
        console.error('Error obteniendo chats:', error);
        res.status(500).json({
            error: true,
            message: 'Error al obtener chats'
        });
    }
});

// Obtener mensajes de un chat específico
router.get('/:sessionId/:chatId/messages', verifyToken, async (req, res) => {
    try {
        const { sessionId, chatId } = req.params;

        // Verificar que la sesión pertenece al usuario
        const [devices] = await pool.execute(
            'SELECT * FROM dispositivos WHERE session_id = ? AND usuario_id = ?',
            [sessionId, req.user.id]
        );

        if (devices.length === 0) {
            return res.status(404).json({
                error: true,
                message: 'Sesión no encontrada'
            });
        }

        // Leer chats.json
        const chatsPath = path.join(__dirname, '../../../sessions', sessionId, 'chats.json');

        if (!fs.existsSync(chatsPath)) {
            return res.json({
                success: true,
                chat: null,
                messages: []
            });
        }

        const chatsData = fs.readFileSync(chatsPath, 'utf8');
        const chats = JSON.parse(chatsData);

        // Buscar el chat específico
        const chat = chats.find(c => c.id === chatId);

        if (!chat) {
            return res.status(404).json({
                error: true,
                message: 'Chat no encontrado'
            });
        }

        res.json({
            success: true,
            chat,
            messages: chat.messages || []
        });

    } catch (error) {
        console.error('Error obteniendo mensajes:', error);
        res.status(500).json({
            error: true,
            message: 'Error al obtener mensajes'
        });
    }
});

// Enviar mensaje de respuesta a un chat
router.post('/:sessionId/:chatId/reply', verifyToken, async (req, res) => {
    try {
        const { sessionId, chatId } = req.params;
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                error: true,
                message: 'El mensaje no puede estar vacío'
            });
        }

        // Verificar que la sesión pertenece al usuario
        const [devices] = await pool.execute(
            'SELECT * FROM dispositivos WHERE session_id = ? AND usuario_id = ?',
            [sessionId, req.user.id]
        );

        if (devices.length === 0) {
            return res.status(404).json({
                error: true,
                message: 'Sesión no encontrada'
            });
        }

        // Obtener el servicio de WhatsApp del servidor
        const whatsappService = req.app.get('whatsappService');
        
        if (!whatsappService) {
            return res.status(500).json({
                error: true,
                message: 'Servicio de WhatsApp no disponible'
            });
        }

        // Normalizar el chatId (asegurar que tenga el formato correcto)
        const normalizedChatId = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;

        // Enviar mensaje
        // NOTA: sendMessage() ya guarda el mensaje en chats.json automáticamente
        // a través de saveChatOutgoing(), por lo que NO necesitamos guardarlo aquí
        await whatsappService.sendMessage(sessionId, chatId.split('@')[0], message.trim());

        res.json({
            success: true,
            message: 'Mensaje enviado correctamente'
        });

    } catch (error) {
        console.error('Error enviando respuesta:', error);
        res.status(500).json({
            error: true,
            message: 'Error al enviar mensaje: ' + (error.message || 'Error desconocido')
        });
    }
});

// Descargar chat individual
router.get('/:sessionId/:chatId/download', verifyToken, async (req, res) => {
    try {
        const { sessionId, chatId } = req.params;

        // Verificar que la sesión pertenece al usuario
        const [devices] = await pool.execute(
            'SELECT * FROM dispositivos WHERE session_id = ? AND usuario_id = ?',
            [sessionId, req.user.id]
        );

        if (devices.length === 0) {
            return res.status(404).json({
                error: true,
                message: 'Sesión no encontrada'
            });
        }

        // Leer chats.json
        const chatsPath = path.join(__dirname, '../../../sessions', sessionId, 'chats.json');

        if (!fs.existsSync(chatsPath)) {
            return res.status(404).json({
                error: true,
                message: 'No hay chats disponibles'
            });
        }

        const chatsData = fs.readFileSync(chatsPath, 'utf8');
        const chats = JSON.parse(chatsData);

        // Buscar el chat específico
        const chat = chats.find(c => c.id === chatId);

        if (!chat) {
            return res.status(404).json({
                error: true,
                message: 'Chat no encontrado'
            });
        }

        // Crear carpeta personalizada: /chats/{telefono}/{fecha}.txt
        const chatNumber = chatId.split('@')[0];
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const chatFolderPath = path.join(__dirname, '../../../chats', chatNumber);
        const chatFilePath = path.join(chatFolderPath, `chat_${today}.txt`);

        // Crear carpeta si no existe
        if (!fs.existsSync(chatFolderPath)) {
            fs.mkdirSync(chatFolderPath, { recursive: true });
        }

        // Generar contenido del chat
        let chatContent = `====================================\n`;
        chatContent += `CHAT CON: ${chat.name || chatNumber}\n`;
        chatContent += `FECHA DE DESCARGA: ${new Date().toLocaleString('es-ES')}\n`;
        chatContent += `TOTAL DE MENSAJES: ${chat.messages ? chat.messages.length : 0}\n`;
        chatContent += `====================================\n\n`;

        if (chat.messages && chat.messages.length > 0) {
            chat.messages.forEach(msg => {
                const timestamp = new Date(msg.timestamp * 1000).toLocaleString('es-ES');
                const from = msg.fromMe ? 'YO' : (chat.name || chatNumber);
                chatContent += `[${timestamp}] ${from}:\n${msg.text}\n\n`;
            });
        } else {
            chatContent += 'No hay mensajes en este chat.\n';
        }

        // Guardar archivo
        fs.writeFileSync(chatFilePath, chatContent, 'utf8');

        res.json({
            success: true,
            message: 'Chat descargado correctamente',
            path: chatFilePath,
            folder: chatNumber
        });

    } catch (error) {
        console.error('Error descargando chat:', error);
        res.status(500).json({
            error: true,
            message: 'Error al descargar chat'
        });
    }
});

// Descargar todos los chats de un dispositivo
router.post('/download-all', verifyToken, async (req, res) => {
    try {
        const { sessionId, chatIds } = req.body; // chatIds es opcional (para descarga selectiva)

        // Verificar que la sesión pertenece al usuario
        const [devices] = await pool.execute(
            'SELECT * FROM dispositivos WHERE session_id = ? AND usuario_id = ?',
            [sessionId, req.user.id]
        );

        if (devices.length === 0) {
            return res.status(404).json({
                error: true,
                message: 'Sesión no encontrada'
            });
        }

        // Leer chats.json
        const chatsPath = path.join(__dirname, '../../../sessions', sessionId, 'chats.json');

        if (!fs.existsSync(chatsPath)) {
            return res.status(404).json({
                error: true,
                message: 'No hay chats disponibles'
            });
        }

        const chatsData = fs.readFileSync(chatsPath, 'utf8');
        const chats = JSON.parse(chatsData);

        // Filtrar chats si se especificaron IDs
        let chatsToDownload = chats;
        if (chatIds && Array.isArray(chatIds) && chatIds.length > 0) {
            chatsToDownload = chats.filter(chat => chatIds.includes(chat.id));
        }

        const downloadedChats = [];
        const today = new Date().toISOString().split('T')[0];

        for (const chat of chatsToDownload) {
            const chatNumber = chat.id.split('@')[0];
            const chatFolderPath = path.join(__dirname, '../../../chats', chatNumber);
            const chatFilePath = path.join(chatFolderPath, `chat_${today}.txt`);

            // Crear carpeta si no existe
            if (!fs.existsSync(chatFolderPath)) {
                fs.mkdirSync(chatFolderPath, { recursive: true });
            }

            // Generar contenido del chat
            let chatContent = `====================================\n`;
            chatContent += `CHAT CON: ${chat.name || chatNumber}\n`;
            chatContent += `FECHA DE DESCARGA: ${new Date().toLocaleString('es-ES')}\n`;
            chatContent += `TOTAL DE MENSAJES: ${chat.messages ? chat.messages.length : 0}\n`;
            chatContent += `====================================\n\n`;

            if (chat.messages && chat.messages.length > 0) {
                chat.messages.forEach(msg => {
                    const timestamp = new Date(msg.timestamp * 1000).toLocaleString('es-ES');
                    const from = msg.fromMe ? 'YO' : (chat.name || chatNumber);
                    chatContent += `[${timestamp}] ${from}:\n${msg.text}\n\n`;
                });
            } else {
                chatContent += 'No hay mensajes en este chat.\n';
            }

            // Guardar archivo
            fs.writeFileSync(chatFilePath, chatContent, 'utf8');
            downloadedChats.push({
                chatId: chat.id,
                chatName: chat.name || chatNumber,
                path: chatFilePath
            });
        }

        res.json({
            success: true,
            message: `${downloadedChats.length} chats descargados correctamente`,
            downloadedChats
        });

    } catch (error) {
        console.error('Error descargando chats:', error);
        res.status(500).json({
            error: true,
            message: 'Error al descargar chats'
        });
    }
});

module.exports = router;
