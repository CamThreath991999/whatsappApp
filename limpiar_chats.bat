@echo off
echo ========================================
echo   LIMPIADOR DE CHATS DUPLICADOS
echo ========================================
echo.
echo ADVERTENCIA: Este script eliminara todos
echo los archivos chats.json de las sesiones.
echo.
echo Los chats se regeneraran correctamente
echo cuando reinicies el servidor.
echo.
echo Presiona Ctrl+C para CANCELAR
echo o cualquier tecla para CONTINUAR...
pause > nul

echo.
echo Creando backup...
if not exist "sessions_backup" mkdir sessions_backup
xcopy /E /I /Y sessions sessions_backup > nul 2>&1
echo ✅ Backup creado en: sessions_backup

echo.
echo Eliminando chats.json...
for /r sessions %%i in (chats.json) do (
    if exist "%%i" (
        del "%%i"
        echo   ✅ Eliminado: %%i
    )
)

echo.
echo ========================================
echo   ✅ LIMPIEZA COMPLETADA
echo ========================================
echo.
echo Ahora reinicia el servidor con: npm start
echo.
pause

