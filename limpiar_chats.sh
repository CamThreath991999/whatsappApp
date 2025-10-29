#!/bin/bash

echo "========================================"
echo "  LIMPIADOR DE CHATS DUPLICADOS"
echo "========================================"
echo ""
echo "ADVERTENCIA: Este script eliminará todos"
echo "los archivos chats.json de las sesiones."
echo ""
echo "Los chats se regenerarán correctamente"
echo "cuando reinicies el servidor."
echo ""
read -p "Presiona Enter para CONTINUAR o Ctrl+C para CANCELAR..."

echo ""
echo "Creando backup..."
if [ -d "sessions_backup" ]; then
    rm -rf sessions_backup
fi
cp -r sessions sessions_backup
echo "✅ Backup creado en: sessions_backup"

echo ""
echo "Eliminando chats.json..."
find sessions -name "chats.json" -type f -exec rm -f {} \; -print | while read file; do
    echo "  ✅ Eliminado: $file"
done

echo ""
echo "========================================"
echo "  ✅ LIMPIEZA COMPLETADA"
echo "========================================"
echo ""
echo "Ahora reinicia el servidor con: npm start"
echo ""

