const { pool } = require('../../config/database');

const CATEGORY_COLORS = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6610f2', '#e83e8c', '#fd7e14', '#20c997', '#6c757d'];

let schemaEnsured = false;

async function safeExecute(query) {
    try {
        await pool.execute(query);
    } catch (error) {
        const ignorableCodes = new Set([
            'ER_DUP_FIELDNAME',
            'ER_DUP_KEYNAME',
            'ER_TABLE_EXISTS_ERROR',
            'ER_CANT_CREATE_TABLE',
            'ER_ALTER_INFO'
        ]);

        if (!ignorableCodes.has(error.code)) {
            console.error('⚠️ Error asegurando esquema de prospectos:', error.message);
        }
    }
}

async function ensureProspectSchema() {
    if (schemaEnsured) {
        return;
    }

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS campana_prospectos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            campana_id INT NOT NULL,
            usuario_id INT NOT NULL,
            telefono VARCHAR(30) NOT NULL,
            nombre VARCHAR(120),
            categoria VARCHAR(120),
            mensaje_original TEXT,
            dispositivo_id INT NOT NULL,
            metadata JSON,
            estado ENUM('pendiente', 'aceptado', 'rechazado') DEFAULT 'pendiente',
            initial_sent TINYINT DEFAULT 0,
            mensaje_inicial_usado TEXT,
            button_accept_id VARCHAR(120),
            button_reject_id VARCHAR(120),
            initial_message_id VARCHAR(120),
            fecha_envio_inicial TIMESTAMP NULL,
            responded_at TIMESTAMP NULL,
            followup_sent TINYINT DEFAULT 0,
            followup_sent_at TIMESTAMP NULL,
            contacto_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (campana_id) REFERENCES campanas(id) ON DELETE CASCADE,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            INDEX idx_campana (campana_id),
            INDEX idx_telefono (telefono),
            INDEX idx_estado (estado)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await safeExecute(`
        ALTER TABLE campana_prospectos
            ADD COLUMN IF NOT EXISTS initial_sent TINYINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS mensaje_inicial_usado TEXT,
            ADD COLUMN IF NOT EXISTS button_accept_id VARCHAR(120),
            ADD COLUMN IF NOT EXISTS button_reject_id VARCHAR(120),
            ADD COLUMN IF NOT EXISTS initial_message_id VARCHAR(120),
            ADD COLUMN IF NOT EXISTS fecha_envio_inicial TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS followup_sent TINYINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS contacto_id INT NULL;
    `);

    await safeExecute(`
        ALTER TABLE campana_prospectos
            ADD INDEX IF NOT EXISTS idx_estado (estado),
            ADD INDEX IF NOT EXISTS idx_campana (campana_id);
    `);

    await safeExecute(`
        ALTER TABLE campana_prospectos
            ADD CONSTRAINT fk_prospecto_campana
                FOREIGN KEY (campana_id) REFERENCES campanas(id) ON DELETE CASCADE;
    `);

    await safeExecute(`
        ALTER TABLE campana_prospectos
            ADD CONSTRAINT fk_prospecto_usuario
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;
    `);

    // Extender ENUM de contactos para nuevos estados si aún no existen
    await safeExecute(`
        ALTER TABLE contactos
            MODIFY COLUMN estado ENUM('pendiente', 'agregado', 'bloqueado', 'invalido', 'aceptado', 'rechazado') DEFAULT 'pendiente';
    `);

    schemaEnsured = true;
}

function sanitizePhone(rawPhone) {
    if (!rawPhone) return '';
    return rawPhone.toString().replace(/\D/g, '');
}

function getSafeName(nombre) {
    if (!nombre) {
        return 'cliente';
    }
    return nombre.toString().trim() || 'cliente';
}

function getSafeCategory(categoria) {
    if (!categoria) {
        return 'nuestra entidad';
    }
    return categoria.toString().trim() || 'nuestra entidad';
}

function generateInitialMessage(nombre, categoria) {
    const safeName = getSafeName(nombre);
    const safeCategory = getSafeCategory(categoria);

    const openings = [
        `Hola ${safeName}`,
        `Buen día ${safeName}`,
        `Estimado/a ${safeName}`,
        `Saludos ${safeName}`,
        `${safeName}, buen día`
    ];

    const bodies = [
        `usaremos este chat para mantenerte al tanto del saldo pendiente con ${safeCategory}.`,
        `por este medio compartiremos información relacionada a la deuda que registras con ${safeCategory}.`,
        `te contactamos para coordinar actualizaciones sobre el compromiso vigente con ${safeCategory}.`,
        `queremos facilitarte las notificaciones sobre la deuda activa que tienes con ${safeCategory}.`,
        `mantendremos desde aquí las novedades sobre tu deuda en ${safeCategory}.`
    ];

    const closings = [
        '¿Deseas continuar la atención por WhatsApp?',
        'Por favor, confirma si deseas recibir la información aquí.',
        'Elige si quieres continuar la gestión desde este canal.',
        'Indica si autorizas que continuemos por este chat.',
        'Selecciona una opción para continuar con el proceso.'
    ];

    const opening = openings[Math.floor(Math.random() * openings.length)];
    const body = bodies[Math.floor(Math.random() * bodies.length)];
    const closing = closings[Math.floor(Math.random() * closings.length)];

    return `${opening}, ${body} ${closing}`;
}

async function insertProspect({
    campanaId,
    usuarioId,
    telefono,
    nombre,
    categoria,
    mensajeOriginal,
    dispositivoId,
    metadata
}) {
    await ensureProspectSchema();

    const sanitizedPhone = sanitizePhone(telefono);
    const metadataString = metadata ? JSON.stringify(metadata) : null;

    const [result] = await pool.execute(
        `INSERT INTO campana_prospectos (
            campana_id, usuario_id, telefono, nombre, categoria, mensaje_original, dispositivo_id, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
            campanaId,
            usuarioId,
            sanitizedPhone,
            nombre || null,
            categoria || null,
            mensajeOriginal || '',
            dispositivoId,
            metadataString
        ]
    );

    return result.insertId;
}

async function getPendingProspects(campaignId) {
    await ensureProspectSchema();

    const [rows] = await pool.execute(
        `SELECT p.*, d.session_id, d.nombre_dispositivo, d.estado as dispositivo_estado
         FROM campana_prospectos p
         JOIN dispositivos d ON p.dispositivo_id = d.id
         WHERE p.campana_id = ? AND p.estado = 'pendiente' AND (p.initial_sent = 0 OR p.initial_sent IS NULL)` ,
        [campaignId]
    );

    return rows;
}

async function markInitialMessageSent(prospectId, {
    initialMessage,
    acceptButtonId,
    rejectButtonId,
    messageKey
}) {
    await ensureProspectSchema();

    await pool.execute(
        `UPDATE campana_prospectos
         SET initial_sent = 1,
             mensaje_inicial_usado = ?,
             button_accept_id = ?,
             button_reject_id = ?,
             initial_message_id = ?,
             fecha_envio_inicial = NOW()
         WHERE id = ?`,
        [initialMessage, acceptButtonId, rejectButtonId, messageKey || null, prospectId]
    );
}

async function incrementCampaignCounter(campaignId, field) {
    const column = field === 'enviados' ? 'mensajes_enviados' : 'mensajes_fallidos';
    await pool.execute(
        `UPDATE campanas SET ${column} = ${column} + 1 WHERE id = ?`,
        [campaignId]
    );
}

async function getOrCreateCategory(usuarioId, categoriaNombre) {
    if (!categoriaNombre) {
        return null;
    }

    const name = categoriaNombre.trim();
    if (!name) {
        return null;
    }

    const [existing] = await pool.execute(
        'SELECT id FROM categorias WHERE usuario_id = ? AND nombre = ?',
        [usuarioId, name]
    );

    if (existing.length > 0) {
        return existing[0].id;
    }

    const randomColor = CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)];

    const [insert] = await pool.execute(
        'INSERT INTO categorias (usuario_id, nombre, color) VALUES (?, ?, ?)',
        [usuarioId, name, randomColor]
    );

    return insert.insertId;
}

async function upsertContactFromProspect({ usuarioId, telefono, nombre, categoriaId, estado, prospectId }) {
    const sanitized = sanitizePhone(telefono);
    const displayName = nombre && nombre.trim() ? nombre.trim() : sanitized;

    const [existing] = await pool.execute(
        'SELECT id FROM contactos WHERE usuario_id = ? AND telefono = ?',
        [usuarioId, sanitized]
    );

    const metadataObj = { prospectId };
    const metadataJson = JSON.stringify(metadataObj);

    if (existing.length > 0) {
        const contactId = existing[0].id;
        await pool.execute(
            `UPDATE contactos
             SET nombre = ?, categoria_id = ?, estado = ?, metadata = ?
             WHERE id = ?`,
            [displayName, categoriaId, estado, metadataJson, contactId]
        );
        return contactId;
    }

    const [insert] = await pool.execute(
        `INSERT INTO contactos (usuario_id, nombre, telefono, categoria_id, estado, metadata)
         VALUES (?, ?, ?, ?, ?, ?)` ,
        [usuarioId, displayName, sanitized, categoriaId, estado, metadataJson]
    );

    return insert.insertId;
}

async function updateProspectResponse({ prospectId, estado, contactoId }) {
    await pool.execute(
        `UPDATE campana_prospectos
         SET estado = ?, contacto_id = ?, responded_at = NOW()
         WHERE id = ?`,
        [estado, contactoId || null, prospectId]
    );
}

async function markFollowupSent(prospectId) {
    await pool.execute(
        `UPDATE campana_prospectos
         SET followup_sent = 1, followup_sent_at = NOW()
         WHERE id = ?`,
        [prospectId]
    );
}

async function getProspectByButtonId(buttonId) {
    await ensureProspectSchema();

    const [rows] = await pool.execute(
        `SELECT p.*, c.usuario_id as campana_usuario, c.id as campana_id, d.session_id, d.nombre_dispositivo
         FROM campana_prospectos p
         JOIN campanas c ON c.id = p.campana_id
         LEFT JOIN dispositivos d ON d.id = p.dispositivo_id
         WHERE p.button_accept_id = ? OR p.button_reject_id = ?`,
        [buttonId, buttonId]
    );

    return rows.length > 0 ? rows[0] : null;
}

module.exports = {
    ensureProspectSchema,
    insertProspect,
    getPendingProspects,
    markInitialMessageSent,
    incrementCampaignCounter,
    generateInitialMessage,
    getOrCreateCategory,
    upsertContactFromProspect,
    updateProspectResponse,
    markFollowupSent,
    getProspectByButtonId
};
