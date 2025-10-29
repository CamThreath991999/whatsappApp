-- Migración: Agregar campo observacion a tabla mensajes
-- Ejecutar solo si la base de datos ya existe y no tiene este campo

USE whatsapp_masivo;

-- Verificar si el campo ya existe antes de agregarlo
SET @dbname = 'whatsapp_masivo';
SET @tablename = 'mensajes';
SET @columnname = 'observacion';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(255) AFTER error_mensaje')
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Mensaje de confirmación
SELECT 'Campo observacion agregado o ya existía' AS resultado;

