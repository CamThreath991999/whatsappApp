const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
const { pool } = require('../../config/database');
const { verifyToken } = require('../middleware/auth');

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

// Obtener campañas del usuario
router.get('/', verifyToken, async (req, res) => {
    try {
        const campaignService = req.app.get('campaignService');
        const campaigns = await campaignService.getUserCampaigns(req.user.id);

        res.json({
            success: true,
            campaigns
        });

    } catch (error) {
        console.error('Error obteniendo campañas:', error);
        res.status(500).json({
            error: true,
            message: 'Error al obtener campañas'
        });
    }
});

// Crear nueva campaña
router.post('/', verifyToken, async (req, res) => {
    try {
        const campaignService = req.app.get('campaignService');
        const result = await campaignService.createCampaign(req.user.id, req.body);

        // Obtener campaña completa
        const [campaigns] = await pool.execute(
            'SELECT * FROM campanas WHERE id = ?',
            [result.campaignId]
        );

        res.json({
            success: true,
            campaign: campaigns[0]
        });

    } catch (error) {
        console.error('Error creando campaña:', error);
        res.status(500).json({
            error: true,
            message: 'Error al crear campaña'
        });
    }
});

// Subir archivo Excel con contactos
router.post('/upload-contacts', verifyToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: true,
                message: 'No se proporcionó archivo'
            });
        }

        const { categoria_id } = req.body;

        // Leer archivo Excel
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        const contactos = [];

        // Procesar cada fila
        for (const row of data) {
            const telefono = row.telefono || row.Telefono || row.TELEFONO || row.phone;
            const nombre = row.nombre || row.Nombre || row.NOMBRE || row.name;
            const mensaje = row.mensaje || row.Mensaje || row.MENSAJE || row.message;

            if (telefono) {
                contactos.push({
                    telefono,
                    nombre: nombre || null,
                    mensaje: mensaje || null,
                    categoria_id: categoria_id || null
                });
            }
        }

        // Insertar contactos en base de datos
        const insertedContacts = [];
        for (const contacto of contactos) {
            try {
                const [result] = await pool.execute(
                    'INSERT INTO contactos (usuario_id, categoria_id, nombre, telefono, estado) VALUES (?, ?, ?, ?, ?)',
                    [req.user.id, contacto.categoria_id, contacto.nombre, contacto.telefono, 'pendiente']
                );

                insertedContacts.push({
                    id: result.insertId,
                    ...contacto
                });
            } catch (error) {
                console.error('Error insertando contacto:', error);
            }
        }

        res.json({
            success: true,
            message: `${insertedContacts.length} contactos importados`,
            contacts: insertedContacts
        });

    } catch (error) {
        console.error('Error procesando archivo:', error);
        res.status(500).json({
            error: true,
            message: 'Error al procesar archivo'
        });
    }
});

// Iniciar campaña
router.post('/:id/start', verifyToken, async (req, res) => {
    try {
        const campaignId = req.params.id;
        const campaignService = req.app.get('campaignService');

        const result = await campaignService.startCampaign(campaignId);

        res.json(result);

    } catch (error) {
        console.error('Error iniciando campaña:', error);
        res.status(500).json({
            error: true,
            message: error.message || 'Error al iniciar campaña'
        });
    }
});

// Pausar campaña
router.post('/:id/pause', verifyToken, async (req, res) => {
    try {
        const campaignId = req.params.id;
        const campaignService = req.app.get('campaignService');

        const result = await campaignService.pauseCampaign(campaignId);

        res.json(result);

    } catch (error) {
        console.error('Error pausando campaña:', error);
        res.status(500).json({
            error: true,
            message: error.message || 'Error al pausar campaña'
        });
    }
});

// Reanudar campaña
router.post('/:id/resume', verifyToken, async (req, res) => {
    try {
        const campaignId = req.params.id;
        const campaignService = req.app.get('campaignService');

        const result = await campaignService.resumeCampaign(campaignId);

        res.json(result);

    } catch (error) {
        console.error('Error reanudando campaña:', error);
        res.status(500).json({
            error: true,
            message: error.message || 'Error al reanudar campaña'
        });
    }
});

// Cancelar campaña
router.post('/:id/cancel', verifyToken, async (req, res) => {
    try {
        const campaignId = req.params.id;
        const campaignService = req.app.get('campaignService');

        const result = await campaignService.cancelCampaign(campaignId);

        res.json(result);

    } catch (error) {
        console.error('Error cancelando campaña:', error);
        res.status(500).json({
            error: true,
            message: error.message || 'Error al cancelar campaña'
        });
    }
});

// Obtener estado de campaña
router.get('/:id/status', verifyToken, async (req, res) => {
    try {
        const campaignId = req.params.id;
        const campaignService = req.app.get('campaignService');

        const status = await campaignService.getCampaignStatus(campaignId);

        res.json({
            success: true,
            status
        });

    } catch (error) {
        console.error('Error obteniendo estado:', error);
        res.status(500).json({
            error: true,
            message: 'Error al obtener estado de campaña'
        });
    }
});

// Obtener errores de campaña
router.get('/:id/errors', verifyToken, async (req, res) => {
    try {
        const campaignId = req.params.id;
        const campaignService = req.app.get('campaignService');

        const errors = await campaignService.getCampaignErrors(campaignId);

        res.json({
            success: true,
            errors,
            total: errors.length
        });

    } catch (error) {
        console.error('Error obteniendo errores:', error);
        res.status(500).json({
            error: true,
            message: 'Error al obtener errores de campaña'
        });
    }
});

module.exports = router;

