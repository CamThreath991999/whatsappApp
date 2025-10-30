/**
 * Rutas para asignación de dispositivos a categorías
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');
const { verifyToken } = require('../middleware/auth');

/**
 * POST /api/category-devices/assign
 * Asignar dispositivos a categorías
 */
router.post('/assign', verifyToken, async (req, res) => {
    try {
        const { assignments } = req.body; // [{categoryId, deviceId}]
        
        if (!assignments || !Array.isArray(assignments)) {
            return res.status(400).json({ 
                error: 'Debe proporcionar un array de asignaciones' 
            });
        }

        console.log(`\n📌 Asignando dispositivos a ${assignments.length} categorías...`);

        for (const { categoryId, deviceId } of assignments) {
            await pool.execute(
                'UPDATE categorias SET dispositivo_id = ? WHERE id = ? AND usuario_id = ?',
                [deviceId, categoryId, req.user.id]
            );
            
            console.log(`   ✅ Categoría ${categoryId} → Dispositivo ${deviceId}`);
        }

        res.json({
            success: true,
            message: `${assignments.length} categoría(s) asignada(s) correctamente`
        });

    } catch (error) {
        console.error('Error asignando dispositivos a categorías:', error);
        res.status(500).json({
            error: 'Error al asignar dispositivos'
        });
    }
});

/**
 * GET /api/category-devices/unassigned
 * Obtener categorías sin dispositivo asignado
 */
router.get('/unassigned', verifyToken, async (req, res) => {
    try {
        const [categories] = await pool.execute(
            `SELECT id, nombre, color 
             FROM categorias 
             WHERE usuario_id = ? AND (dispositivo_id IS NULL OR dispositivo_id = 0)
             ORDER BY nombre`,
            [req.user.id]
        );

        res.json({
            success: true,
            categories
        });

    } catch (error) {
        console.error('Error obteniendo categorías sin asignar:', error);
        res.status(500).json({
            error: 'Error al obtener categorías'
        });
    }
});

module.exports = router;

