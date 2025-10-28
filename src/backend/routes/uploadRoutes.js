/**
 * Rutas para subir archivos (Excel de contactos)
 */

const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { pool } = require('../../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Configurar multer para subir archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.xlsx' && ext !== '.xls') {
            return cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
        }
        cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

/**
 * POST /api/upload/contacts-excel
 * Subir Excel con contactos para campaña
 * Campos esperados: categoria | telefono | nombre | mensaje
 */
router.post('/contacts-excel', verifyToken, upload.single('file'), async (req, res) => {
    try {
        console.log('\n📤 Recibiendo archivo Excel de contactos...');
        
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }

        const { campaignId, categoryId } = req.body;
        
        if (!campaignId) {
            return res.status(400).json({ error: 'campaignId es requerido' });
        }

        console.log(`   Archivo: ${req.file.filename}`);
        console.log(`   Campaña: ${campaignId}, Categoría: ${categoryId || 'N/A'}`);

        // Obtener TODOS los dispositivos conectados del usuario
        const [devices] = await pool.execute(
            'SELECT id, nombre_dispositivo, session_id FROM dispositivos WHERE usuario_id = ? AND estado = ? ORDER BY id',
            [req.user.id, 'conectado']
        );

        if (devices.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ 
                error: 'No hay dispositivos conectados. Conecta al menos un dispositivo primero.' 
            });
        }

        console.log(`   📱 Dispositivos conectados: ${devices.length}`);
        devices.forEach(d => console.log(`      - ID ${d.id}: ${d.nombre_dispositivo} (${d.session_id})`));
        
        // **ESTRATEGIA DE ROTACIÓN DINÁMICA**
        const useRotation = devices.length > 1;
        console.log(`   🔄 Estrategia: ${useRotation ? 'ROTACIÓN ACTIVA' : 'DISPOSITIVO ÚNICO'}`);
        
        let deviceRotationIndex = 0;
        const singleDeviceId = devices[0].id; // Para cuando solo hay 1 dispositivo

        // Leer archivo Excel
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        console.log(`   📊 ${data.length} filas encontradas`);
        console.log(`   📋 Primeras 3 filas del Excel:`);
        data.slice(0, 3).forEach((row, idx) => {
            console.log(`      Fila ${idx + 1}:`, JSON.stringify(row, null, 2));
        });

        if (data.length === 0) {
            fs.unlinkSync(req.file.path); // Eliminar archivo
            return res.status(400).json({ error: 'El archivo Excel está vacío' });
        }

        // Procesar contactos
        let added = 0;
        let errors = 0;
        let processLog = [];

        for (const row of data) {
            try {
                // Normalizar campos (case-insensitive)
                const telefono = row.telefono || row.Telefono || row.TELEFONO || row.phone;
                const nombre = row.nombre || row.Nombre || row.NOMBRE || row.name || '';
                const mensaje = row.mensaje || row.Mensaje || row.MENSAJE || row.message || '';
                const categoria = row.categoria || row.Categoria || row.CATEGORIA || row.category || categoryId;

                processLog.push({
                    telefono,
                    nombre: nombre || 'sin nombre',
                    mensaje: mensaje ? mensaje.substring(0, 30) + '...' : 'sin mensaje',
                    categoria: categoria || 'sin categoría'
                });

                if (!telefono) {
                    console.warn(`   ⚠️ Fila sin teléfono, saltando:`, row);
                    errors++;
                    continue;
                }

                // Limpiar teléfono (solo números)
                const telefonoLimpio = telefono.toString().replace(/\D/g, '');

                if (telefonoLimpio.length < 7) {
                    console.warn(`   ⚠️ Teléfono inválido: ${telefono}`);
                    errors++;
                    continue;
                }

                // Buscar o crear categoría por nombre
                let categoriaId = null;
                if (categoria) {
                    // Buscar categoría por nombre
                    const [categorias] = await pool.execute(
                        'SELECT id FROM categorias WHERE nombre = ?',
                        [categoria]
                    );

                    if (categorias.length > 0) {
                        categoriaId = categorias[0].id;
                    } else {
                        // Crear nueva categoría
                        const [resultCat] = await pool.execute(
                            'INSERT INTO categorias (nombre) VALUES (?)',
                            [categoria]
                        );
                        categoriaId = resultCat.insertId;
                        console.log(`   ✅ Categoría "${categoria}" creada con ID ${categoriaId}`);
                    }
                }

                // Buscar o crear contacto
                let [contacto] = await pool.execute(
                    'SELECT id FROM contactos WHERE telefono = ?',
                    [telefonoLimpio]
                );

                let contactoId;

                if (contacto.length === 0) {
                    // Crear nuevo contacto con usuario_id
                    const [result] = await pool.execute(
                        'INSERT INTO contactos (usuario_id, nombre, telefono, categoria_id) VALUES (?, ?, ?, ?)',
                        [req.user.id, nombre || telefonoLimpio, telefonoLimpio, categoriaId]
                    );
                    contactoId = result.insertId;
                } else {
                    contactoId = contacto[0].id;
                    
                    // Actualizar nombre y categoría si cambió
                    if (nombre || categoriaId) {
                        await pool.execute(
                            'UPDATE contactos SET nombre = COALESCE(?, nombre), categoria_id = COALESCE(?, categoria_id) WHERE id = ?',
                            [nombre, categoriaId, contactoId]
                        );
                    }
                }

                // **ROTACIÓN DINÁMICA DE DISPOSITIVOS**
                let deviceId;
                if (useRotation) {
                    // MÚLTIPLES DISPOSITIVOS: Rotación aleatoria o secuencial
                    if (Math.random() < 0.7) {
                        // 70% rotación secuencial (más predecible, menos sospechoso)
                        deviceId = devices[deviceRotationIndex].id;
                        deviceRotationIndex = (deviceRotationIndex + 1) % devices.length;
                    } else {
                        // 30% selección aleatoria (más impredecible)
                        deviceId = devices[Math.floor(Math.random() * devices.length)].id;
                    }
                } else {
                    // UN SOLO DISPOSITIVO: Usar siempre el mismo
                    deviceId = singleDeviceId;
                }
                
                // Agregar mensaje a la campaña con dispositivo rotado
                await pool.execute(
                    `INSERT INTO mensajes (campana_id, contacto_id, dispositivo_id, mensaje, estado) 
                     VALUES (?, ?, ?, ?, 'pendiente')`,
                    [campaignId, contactoId, deviceId, mensaje || req.body.defaultMessage || 'Mensaje predeterminado']
                );

                added++;
                
                if (added % 10 === 0) {
                    console.log(`   📊 Procesados: ${added} mensajes...`);
                }

            } catch (error) {
                console.error(`   ❌ Error procesando fila:`, error.message);
                errors++;
            }
        }

        // Actualizar cantidad de mensajes en campaña
        await pool.execute(
            'UPDATE campanas SET total_mensajes = total_mensajes + ? WHERE id = ?',
            [added, campaignId]
        );

        // Obtener distribución de mensajes por dispositivo
        const [distribution] = await pool.execute(
            `SELECT d.id, d.nombre_dispositivo, COUNT(*) as total 
             FROM mensajes m 
             JOIN dispositivos d ON m.dispositivo_id = d.id 
             WHERE m.campana_id = ? 
             GROUP BY d.id`,
            [campaignId]
        );

        // Eliminar archivo después de procesar
        fs.unlinkSync(req.file.path);

        console.log(`   ✅ Procesamiento completo: ${added} contactos agregados, ${errors} errores`);
        console.log(`   🔄 DISTRIBUCIÓN DE MENSAJES POR DISPOSITIVO:`);
        distribution.forEach(d => {
            console.log(`      📱 Dispositivo ${d.id} (${d.nombre_dispositivo}): ${d.total} mensajes`);
        });
        console.log(`   📋 Resumen de contactos procesados:`);
        processLog.slice(0, 5).forEach((log, idx) => {
            console.log(`      ${idx + 1}. ${log.nombre} (${log.telefono}) - ${log.mensaje}`);
        });
        if (processLog.length > 5) {
            console.log(`      ... y ${processLog.length - 5} más`);
        }
        console.log('');

        res.json({
            success: true,
            message: `${added} contactos importados correctamente`,
            total: data.length,
            added,
            errors,
            contacts: processLog
        });

    } catch (error) {
        console.error('❌ Error subiendo Excel:', error);
        
        // Eliminar archivo en caso de error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({
            error: 'Error procesando archivo Excel',
            details: error.message
        });
    }
});

module.exports = router;

