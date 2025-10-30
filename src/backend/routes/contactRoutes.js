const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');
const { verifyToken } = require('../middleware/auth');
const WhatsAppServiceBaileys = require('../services/whatsappServiceBaileys');

// Obtener contactos del usuario
router.get('/', verifyToken, async (req, res) => {
    try {
        const { categoria_id } = req.query;

        let query = `SELECT c.*, cat.nombre as categoria_nombre 
                     FROM contactos c
                     LEFT JOIN categorias cat ON c.categoria_id = cat.id
                     WHERE c.usuario_id = ?`;
        const params = [req.user.id];

        if (categoria_id) {
            query += ' AND c.categoria_id = ?';
            params.push(categoria_id);
        }

        query += ' ORDER BY c.fecha_agregado DESC';

        const [contacts] = await pool.execute(query, params);

        res.json({
            success: true,
            contacts
        });

    } catch (error) {
        console.error('Error obteniendo contactos:', error);
        res.status(500).json({
            error: true,
            message: 'Error al obtener contactos'
        });
    }
});

// Crear contacto individual
router.post('/', verifyToken, async (req, res) => {
    try {
        const { nombre, telefono, categoria_id } = req.body;

        if (!telefono) {
            return res.status(400).json({
                error: true,
                message: 'El teléfono es requerido'
            });
        }

        const [result] = await pool.execute(
            'INSERT INTO contactos (usuario_id, categoria_id, nombre, telefono, estado) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, categoria_id || null, nombre || null, telefono, 'pendiente']
        );

        res.json({
            success: true,
            contact: {
                id: result.insertId,
                nombre,
                telefono,
                categoria_id
            }
        });

    } catch (error) {
        console.error('Error creando contacto:', error);
        res.status(500).json({
            error: true,
            message: 'Error al crear contacto'
        });
    }
});

// Actualizar categoría de contacto
router.patch('/:id/categoria', verifyToken, async (req, res) => {
    try {
        const contactId = req.params.id;
        const { categoria_id } = req.body;

        // Verificar que el contacto pertenece al usuario
        const [contacts] = await pool.execute(
            'SELECT * FROM contactos WHERE id = ? AND usuario_id = ?',
            [contactId, req.user.id]
        );

        if (contacts.length === 0) {
            return res.status(404).json({
                error: true,
                message: 'Contacto no encontrado'
            });
        }

        // Actualizar categoría
        await pool.execute(
            'UPDATE contactos SET categoria_id = ? WHERE id = ?',
            [categoria_id || null, contactId]
        );

        res.json({
            success: true,
            message: 'Categoría actualizada correctamente'
        });

    } catch (error) {
        console.error('Error actualizando categoría:', error);
        res.status(500).json({
            error: true,
            message: 'Error al actualizar categoría'
        });
    }
});

// Eliminar contacto
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const contactId = req.params.id;

        // Verificar que el contacto pertenece al usuario
        const [contacts] = await pool.execute(
            'SELECT * FROM contactos WHERE id = ? AND usuario_id = ?',
            [contactId, req.user.id]
        );

        if (contacts.length === 0) {
            return res.status(404).json({
                error: true,
                message: 'Contacto no encontrado'
            });
        }

        // Eliminar contacto
        await pool.execute(
            'DELETE FROM contactos WHERE id = ?',
            [contactId]
        );

        res.json({
            success: true,
            message: 'Contacto eliminado correctamente'
        });

    } catch (error) {
        console.error('Error eliminando contacto:', error);
        res.status(500).json({
            error: true,
            message: 'Error al eliminar contacto'
        });
    }
});

/**
 * GET /api/contacts/:id/profile-picture
 * Obtener foto de perfil de WhatsApp de un contacto
 */
router.get('/:id/profile-picture', verifyToken, async (req, res) => {
    try {
        const contactId = req.params.id;

        // Verificar que el contacto pertenece al usuario
        const [contacts] = await pool.execute(
            'SELECT * FROM contactos WHERE id = ? AND usuario_id = ?',
            [contactId, req.user.id]
        );

        if (contacts.length === 0) {
            return res.status(404).json({
                error: true,
                message: 'Contacto no encontrado'
            });
        }

        const contact = contacts[0];

        // Si ya tiene foto guardada y fue obtenida hace menos de 7 días, devolverla
        if (contact.foto_perfil && contact.fecha_foto) {
            const diasDesdeUltimaFoto = (Date.now() - new Date(contact.fecha_foto).getTime()) / (1000 * 60 * 60 * 24);
            if (diasDesdeUltimaFoto < 7) {
                console.log(`📸 Usando foto cacheada para ${contact.telefono}`);
                return res.json({
                    success: true,
                    profilePicture: contact.foto_perfil,
                    cached: true
                });
            }
        }

        // Obtener dispositivo conectado del usuario
        const [devices] = await pool.execute(
            'SELECT * FROM dispositivos WHERE usuario_id = ? AND estado = ? LIMIT 1',
            [req.user.id, 'conectado']
        );

        if (devices.length === 0) {
            return res.status(400).json({
                error: true,
                message: 'No hay dispositivos conectados'
            });
        }

        const device = devices[0];

        // Obtener servicio de WhatsApp (necesitamos acceso a la instancia global)
        // Por ahora, crearemos una instancia temporal
        const whatsappService = req.app.get('whatsappService');
        
        if (!whatsappService) {
            return res.status(500).json({
                error: true,
                message: 'Servicio de WhatsApp no disponible'
            });
        }

        // Obtener foto de perfil
        const profilePicUrl = await whatsappService.getProfilePicture(device.session_id, contact.telefono);

        // Guardar en BD
        if (profilePicUrl) {
            await pool.execute(
                'UPDATE contactos SET foto_perfil = ?, fecha_foto = NOW() WHERE id = ?',
                [profilePicUrl, contactId]
            );

            res.json({
                success: true,
                profilePicture: profilePicUrl,
                cached: false
            });
        } else {
            res.json({
                success: true,
                profilePicture: null,
                message: 'El contacto no tiene foto de perfil'
            });
        }

    } catch (error) {
        console.error('Error obteniendo foto de perfil:', error);
        res.status(500).json({
            error: true,
            message: 'Error al obtener foto de perfil'
        });
    }
});

/**
 * POST /api/contacts/fetch-profile-pictures-batch
 * Obtener fotos de perfil de múltiples contactos de forma gradual (anti-SPAM)
 */
router.post('/fetch-profile-pictures-batch', verifyToken, async (req, res) => {
    try {
        const { contactIds, delayBetween = 3000 } = req.body; // Delay de 3s por defecto

        if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
            return res.status(400).json({
                error: true,
                message: 'Se requiere un array de IDs de contactos'
            });
        }

        console.log(`📸 Obteniendo fotos de ${contactIds.length} contactos (delay: ${delayBetween}ms)`);

        // Obtener dispositivo conectado
        const [devices] = await pool.execute(
            'SELECT * FROM dispositivos WHERE usuario_id = ? AND estado = ? LIMIT 1',
            [req.user.id, 'conectado']
        );

        if (devices.length === 0) {
            return res.status(400).json({
                error: true,
                message: 'No hay dispositivos conectados'
            });
        }

        const device = devices[0];
        const whatsappService = req.app.get('whatsappService');

        if (!whatsappService) {
            return res.status(500).json({
                error: true,
                message: 'Servicio de WhatsApp no disponible'
            });
        }

        // Procesar en background (no bloquear la respuesta)
        res.json({
            success: true,
            message: `Procesando ${contactIds.length} contactos en background`,
            total: contactIds.length
        });

        // Procesar de forma asíncrona con delays
        (async () => {
            let processed = 0;
            let success = 0;
            let failed = 0;

            for (const contactId of contactIds) {
                try {
                    // Obtener contacto
                    const [contacts] = await pool.execute(
                        'SELECT * FROM contactos WHERE id = ? AND usuario_id = ?',
                        [contactId, req.user.id]
                    );

                    if (contacts.length === 0) {
                        failed++;
                        continue;
                    }

                    const contact = contacts[0];

                    // Si ya tiene foto reciente, saltarla
                    if (contact.foto_perfil && contact.fecha_foto) {
                        const diasDesdeUltimaFoto = (Date.now() - new Date(contact.fecha_foto).getTime()) / (1000 * 60 * 60 * 24);
                        if (diasDesdeUltimaFoto < 7) {
                            processed++;
                            success++;
                            continue;
                        }
                    }

                    // Obtener foto
                    const profilePicUrl = await whatsappService.getProfilePicture(device.session_id, contact.telefono);

                    if (profilePicUrl) {
                        await pool.execute(
                            'UPDATE contactos SET foto_perfil = ?, fecha_foto = NOW() WHERE id = ?',
                            [profilePicUrl, contactId]
                        );
                        success++;
                    } else {
                        failed++;
                    }

                    processed++;

                    // Delay anti-SPAM (aleatorio entre delayBetween y delayBetween*1.5)
                    const randomDelay = delayBetween + Math.floor(Math.random() * (delayBetween * 0.5));
                    await new Promise(resolve => setTimeout(resolve, randomDelay));

                } catch (error) {
                    console.error(`❌ Error procesando contacto ${contactId}:`, error);
                    failed++;
                    processed++;
                }
            }

            console.log(`✅ Fotos procesadas: ${processed}/${contactIds.length} (${success} exitosas, ${failed} fallidas)`);
        })();

    } catch (error) {
        console.error('Error en batch de fotos de perfil:', error);
        res.status(500).json({
            error: true,
            message: 'Error al procesar fotos de perfil'
        });
    }
});

module.exports = router;

