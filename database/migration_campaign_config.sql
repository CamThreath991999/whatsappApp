-- Migración: Agregar configuración de horarios y límites a campañas
-- Fecha: 2025-10-30

USE whatsapp_masivo;

-- Agregar columnas de configuración horaria a tabla campanas
ALTER TABLE campanas 
ADD COLUMN IF NOT EXISTS horario_inicio TIME DEFAULT '08:00:00' COMMENT 'Hora inicio de envío (ej: 08:00:00)',
ADD COLUMN IF NOT EXISTS horario_fin TIME DEFAULT '19:00:00' COMMENT 'Hora fin de envío (ej: 19:00:00)',
ADD COLUMN IF NOT EXISTS max_mensajes_dia INT DEFAULT 300 COMMENT 'Máximo de mensajes por día',
ADD COLUMN IF NOT EXISTS distribucion_automatica BOOLEAN DEFAULT TRUE COMMENT 'Distribuir automáticamente en el horario';

-- Crear tabla de notas persistentes
CREATE TABLE IF NOT EXISTS notas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    contenido TEXT,
    color VARCHAR(7) DEFAULT '#ffc107',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id),
    INDEX idx_fecha_creacion (fecha_creacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Actualizar tabla mensajes para detectar números inválidos
ALTER TABLE mensajes 
ADD COLUMN IF NOT EXISTS numero_invalido BOOLEAN DEFAULT FALSE COMMENT 'Si el número no existe o es inválido';

COMMIT;

