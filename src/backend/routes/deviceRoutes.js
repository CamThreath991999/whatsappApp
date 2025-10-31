const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');
const { verifyToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { redisHelper } = require('../../config/redis');

// Obtener dispositivos del usuario
router.get('/', verifyToken, async (req, res) => {
    try {
        const [devices] = await pool.execute(
            'SELECT * FROM dispositivos WHERE usuario_id = ? ORDER BY fecha_creacion DESC',
            [req.user.id]
        );

        res.json({
            success: true,
            devices
        });

    } catch (error) {
        console.error('Error obteniendo dispositivos:', error);
        res.status(500).json({
            error: true,
            message: 'Error al obtener dispositivos'
        });
    }
});

// Crear nuevo dispositivo
router.post('/', verifyToken, async (req, res) => {
    try {
        const { nombre_dispositivo } = req.body;

        if (!nombre_dispositivo) {
            return res.status(400).json({
                error: true,
                message: 'El nombre del dispositivo es requerido'
            });
        }

        // Verificar límite de dispositivos (máximo 20)
        const [devices] = await pool.execute(
            'SELECT COUNT(*) as total FROM dispositivos WHERE usuario_id = ?',
            [req.user.id]
        );

        if (devices[0].total >= 20) {
            return res.status(400).json({
                error: true,
                message: 'Has alcanzado el límite máximo de 20 dispositivos'
            });
        }

        // Generar session_id único
        const session_id = `session_${uuidv4()}`;

        // Crear dispositivo
        const [result] = await pool.execute(
            'INSERT INTO dispositivos (usuario_id, nombre_dispositivo, session_id, estado) VALUES (?, ?, ?, ?)',
            [req.user.id, nombre_dispositivo, session_id, 'desconectado']
        );

        res.json({
            success: true,
            device: {
                id: result.insertId,
                nombre_dispositivo,
                session_id,
                estado: 'desconectado'
            }
        });

    } catch (error) {
        console.error('Error creando dispositivo:', error);
        res.status(500).json({
            error: true,
            message: 'Error al crear dispositivo'
        });
    }
});

// Eliminar dispositivo
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const deviceId = req.params.id;

        // Verificar que el dispositivo pertenece al usuario
        const [devices] = await pool.execute(
            'SELECT * FROM dispositivos WHERE id = ? AND usuario_id = ?',
            [deviceId, req.user.id]
        );

        if (devices.length === 0) {
            return res.status(404).json({
                error: true,
                message: 'Dispositivo no encontrado'
            });
        }

        // Eliminar dispositivo
        await pool.execute(
            'DELETE FROM dispositivos WHERE id = ?',
            [deviceId]
        );

        res.json({
            success: true,
            message: 'Dispositivo eliminado correctamente'
        });

    } catch (error) {
        console.error('Error eliminando dispositivo:', error);
        res.status(500).json({
            error: true,
            message: 'Error al eliminar dispositivo'
        });
    }
});

// Obtener QR desde cache (Redis) como fallback
router.get('/qr/:sessionId', verifyToken, async (req, res) => {
    try {
        const sessionId = req.params.sessionId;

        const qr = await redisHelper.getCache(`qr:${sessionId}`);

        if (!qr) {
            return res.status(404).json({
                success: false,
                message: 'QR no disponible'
            });
        }

        res.json({
            success: true,
            sessionId,
            qr
        });

    } catch (error) {
        console.error('Error obteniendo QR desde Redis:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener QR'
        });
    }
});

module.exports = router;


