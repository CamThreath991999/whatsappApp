-- Migración: Agregar campo foto_perfil a tabla contactos
-- Fecha: 2025-10-30
-- Descripción: Permitir almacenar URL de foto de perfil de WhatsApp

USE whatsapp_masivo;

-- Agregar campo foto_perfil a contactos
ALTER TABLE contactos 
ADD COLUMN IF NOT EXISTS foto_perfil VARCHAR(500) AFTER telefono_formateado,
ADD COLUMN IF NOT EXISTS fecha_foto TIMESTAMP NULL AFTER foto_perfil;

-- Índice para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_foto_perfil ON contactos(foto_perfil);

-- Mensaje de confirmación
SELECT 'Campo foto_perfil agregado a tabla contactos' AS resultado;

-- Ver estructura actualizada
DESCRIBE contactos;

