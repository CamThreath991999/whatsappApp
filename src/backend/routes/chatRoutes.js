const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');
const { verifyToken } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Obtener chats del usuario desde sessions/*/chats.json
router.get('/', verifyToken, async (req, res) => {
    try {
        const { dispositivo_id } = req.query;

        // Obtener dispositivos del usuario
        let deviceQuery = 'SELECT * FROM dispositivos WHERE usuario_id = ?';
        const deviceParams = [req.user.id];

        if (dispositivo_id) {
            deviceQuery += ' AND id = ?';
            deviceParams.push(dispositivo_id);
        }

        const [devices] = await pool.execute(deviceQuery, deviceParams);

        // Leer chats.json de cada dispositivo
        const allChats = [];

        for (const device of devices) {
            if (!device.session_id) continue;

            const chatsPath = path.join(__dirname, '../../../sessions', device.session_id, 'chats.json');

            if (fs.existsSync(chatsPath)) {
                try {
                    const chatsData = fs.readFileSync(chatsPath, 'utf8');
                    const chats = JSON.parse(chatsData);

                    // Agregar info del dispositivo
                    chats.forEach(chat => {
                        chat.deviceName = device.nombre;
                        chat.deviceId = device.id;
                        chat.sessionId = device.session_id;
                    });

                    allChats.push(...chats);
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
            totalDevices: devices.length
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
        await whatsappService.sendMessage(sessionId, chatId.split('@')[0], message.trim());

        // Guardar mensaje en chats.json para evitar duplicación
        const chatsPath = path.join(__dirname, '../../../sessions', sessionId, 'chats.json');
        const sessionPath = path.join(__dirname, '../../../sessions', sessionId);
        
        // Asegurar que el directorio de sesión existe
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }

        let chats = [];
        if (fs.existsSync(chatsPath)) {
            try {
                const chatsData = fs.readFileSync(chatsPath, 'utf8');
                chats = JSON.parse(chatsData);
            } catch (err) {
                console.error('Error leyendo chats.json:', err);
                chats = [];
            }
        }

        // Buscar o crear el chat usando el chatId normalizado
        let chat = chats.find(c => c.id === normalizedChatId);
        
        if (!chat) {
            // Crear nuevo chat si no existe
            chat = {
                id: normalizedChatId,
                name: chatId.split('@')[0],
                messages: [],
                lastMessage: '',
                lastTimestamp: 0,
                unreadCount: 0
            };
            chats.push(chat);
        }

        // Agregar mensaje al chat
        const timestamp = Math.floor(Date.now() / 1000);
        chat.messages.push({
            text: message.trim(),
            timestamp: timestamp,
            fromMe: true
        });
        
        chat.lastMessage = message.trim();
        chat.lastTimestamp = timestamp;

        // Mantener solo últimos 100 mensajes por chat
        if (chat.messages.length > 100) {
            chat.messages = chat.messages.slice(-100);
        }

        // Guardar chats actualizados
        try {
            fs.writeFileSync(chatsPath, JSON.stringify(chats, null, 2));
        } catch (err) {
            console.error('Error guardando chats.json:', err);
        }

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

module.exports = router;
