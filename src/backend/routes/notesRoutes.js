const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');
const { verifyToken } = require('../middleware/auth');

// Obtener todas las notas del usuario
router.get('/', verifyToken, async (req, res) => {
    try {
        const [notas] = await pool.execute(
            'SELECT * FROM notas WHERE usuario_id = ? ORDER BY fecha_actualizacion DESC',
            [req.user.id]
        );

        res.json({
            success: true,
            notas
        });

    } catch (error) {
        console.error('Error obteniendo notas:', error);
        res.status(500).json({
            error: true,
            message: 'Error al obtener notas'
        });
    }
});

// Crear nueva nota
router.post('/', verifyToken, async (req, res) => {
    try {
        const { titulo, contenido, color } = req.body;

        if (!titulo) {
            return res.status(400).json({
                error: true,
                message: 'El título es requerido'
            });
        }

        const [result] = await pool.execute(
            'INSERT INTO notas (usuario_id, titulo, contenido, color) VALUES (?, ?, ?, ?)',
            [req.user.id, titulo, contenido || '', color || '#ffc107']
        );

        const [notas] = await pool.execute(
            'SELECT * FROM notas WHERE id = ?',
            [result.insertId]
        );

        res.json({
            success: true,
            nota: notas[0]
        });

    } catch (error) {
        console.error('Error creando nota:', error);
        res.status(500).json({
            error: true,
            message: 'Error al crear nota'
        });
    }
});

// Actualizar nota
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { titulo, contenido, color } = req.body;

        // Verificar que la nota pertenece al usuario
        const [existing] = await pool.execute(
            'SELECT * FROM notas WHERE id = ? AND usuario_id = ?',
            [id, req.user.id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                error: true,
                message: 'Nota no encontrada'
            });
        }

        await pool.execute(
            'UPDATE notas SET titulo = ?, contenido = ?, color = ? WHERE id = ?',
            [titulo, contenido, color, id]
        );

        const [notas] = await pool.execute(
            'SELECT * FROM notas WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            nota: notas[0]
        });

    } catch (error) {
        console.error('Error actualizando nota:', error);
        res.status(500).json({
            error: true,
            message: 'Error al actualizar nota'
        });
    }
});

// Eliminar nota
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que la nota pertenece al usuario
        const [existing] = await pool.execute(
            'SELECT * FROM notas WHERE id = ? AND usuario_id = ?',
            [id, req.user.id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                error: true,
                message: 'Nota no encontrada'
            });
        }

        await pool.execute('DELETE FROM notas WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Nota eliminada'
        });

    } catch (error) {
        console.error('Error eliminando nota:', error);
        res.status(500).json({
            error: true,
            message: 'Error al eliminar nota'
        });
    }
});

module.exports = router;

