@echo off
REM Script de despliegue automático después de hacer pull desde GitHub (Windows)
REM Uso: deploy.bat

echo 🚀 === INICIANDO DESPLIEGUE AUTOMÁTICO ===
echo.

REM 1. Detener el contenedor de la app
echo 📦 Paso 1: Deteniendo contenedor whatsapp-app...
docker-compose stop app
if errorlevel 1 (
    echo ⚠️  Contenedor no estaba corriendo
)

REM 2. Hacer pull de cambios (si es necesario)
echo.
echo 📥 Paso 2: Verificando cambios de Git...
git pull origin main
if errorlevel 1 (
    echo ⚠️  No se pudo hacer pull, continuando...
)

REM 3. Reconstruir la imagen
echo.
echo 🔨 Paso 3: Reconstruyendo imagen Docker...
docker-compose build app

REM 4. Iniciar el contenedor
echo.
echo ▶️  Paso 4: Iniciando contenedor...
docker-compose up -d app

REM 5. Ver logs para verificar que inició correctamente
echo.
echo 📋 Paso 5: Verificando logs (últimas 20 líneas)...
timeout /t 3 /nobreak >nul
docker-compose logs --tail=20 app

echo.
echo ✅ === DESPLIEGUE COMPLETADO ===
echo.
echo Para ver logs en tiempo real: docker-compose logs -f app
echo Para ver estado de contenedores: docker-compose ps

pause

