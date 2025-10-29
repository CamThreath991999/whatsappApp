-- Migración: Agregar campo metadata a tabla mensajes
-- Ejecutar solo si la base de datos ya existe y no tiene este campo

USE whatsapp_masivo;

-- Verificar y agregar campo metadata
SET @dbname = 'whatsapp_masivo';
SET @tablename = 'mensajes';
SET @columnname = 'metadata';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' JSON AFTER observacion')
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Mensaje de confirmación
SELECT 'Campo metadata agregado o ya existía' AS resultado;

