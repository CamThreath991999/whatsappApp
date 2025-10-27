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

module.exports = router;

