@echo off
REM ==================================
REM Script de Despliegue Kubernetes (Windows)
REM Sistema WhatsApp Masivo
REM ==================================

setlocal enabledelayedexpansion

set NAMESPACE=whatsapp-masivo
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%\..

echo 🚀 Iniciando despliegue en Kubernetes...
echo 📂 Directorio del proyecto: %PROJECT_ROOT%
echo 📦 Namespace: %NAMESPACE%
echo.

REM Verificar que kubectl está instalado
where kubectl >nul 2>&1
if errorlevel 1 (
    echo ❌ kubectl no está instalado. Por favor instálalo primero.
    exit /b 1
)

echo ✅ kubectl encontrado

REM Verificar conexión al cluster
kubectl cluster-info >nul 2>&1
if errorlevel 1 (
    echo ❌ No se puede conectar al cluster de Kubernetes.
    exit /b 1
)

echo ✅ Conectado al cluster de Kubernetes

REM Crear namespace si no existe
echo.
echo 📦 Creando namespace...
kubectl create namespace %NAMESPACE% 2>nul || echo ⚠️  Namespace ya existe

REM Aplicar secrets y configmap
echo.
echo 🔐 Aplicando secrets y configmap...
kubectl apply -f "%SCRIPT_DIR%secrets.yaml"
kubectl apply -f "%SCRIPT_DIR%configmap.yaml"
echo ✅ Secrets y ConfigMap aplicados

REM Crear script de inicialización MySQL
echo.
echo 🗄️  Creando script de inicialización MySQL...
if exist "%PROJECT_ROOT%\database\schema.sql" (
    kubectl create configmap mysql-init-script --from-file=init.sql="%PROJECT_ROOT%\database\schema.sql" -n %NAMESPACE% 2>nul || echo ⚠️  ConfigMap de MySQL ya existe
    echo ✅ Script de inicialización MySQL creado
) else (
    echo ❌ No se encontró database\schema.sql
    exit /b 1
)

REM Desplegar MySQL
echo.
echo 🗄️  Desplegando MySQL...
kubectl apply -f "%SCRIPT_DIR%mysql.yaml"
echo ✅ MySQL desplegado

REM Desplegar Redis
echo.
echo 📦 Desplegando Redis...
kubectl apply -f "%SCRIPT_DIR%redis.yaml"
echo ✅ Redis desplegado

REM Esperar a que MySQL esté listo
echo.
echo ⏳ Esperando a que MySQL esté listo...
timeout /t 10 /nobreak >nul
echo ✅ MySQL debería estar listo

REM Crear PersistentVolumes (si existen)
echo.
echo 💾 Creando PersistentVolumes...
if exist "%SCRIPT_DIR%pv-sessions-nfs.yaml" (
    kubectl apply -f "%SCRIPT_DIR%pv-sessions-nfs.yaml"
    echo ✅ PV de sesiones creado
) else (
    echo ⚠️  No se encontró pv-sessions-nfs.yaml (saltando...)
)

if exist "%SCRIPT_DIR%pvc-adicionales.yaml" (
    kubectl apply -f "%SCRIPT_DIR%pvc-adicionales.yaml"
    echo ✅ PVCs adicionales creados
) else (
    echo ⚠️  No se encontró pvc-adicionales.yaml (saltando...)
)

REM Desplegar aplicación
echo.
echo 🚀 Desplegando aplicación...
kubectl apply -f "%SCRIPT_DIR%app.yaml"
echo ✅ Aplicación desplegada

REM (Opcional) Desplegar Ingress
if exist "%SCRIPT_DIR%ingress.yaml" (
    echo.
    echo 🌐 Desplegando Ingress...
    set /p DEPLOY_INGRESS="¿Deseas desplegar Ingress? (s/N): "
    if /i "!DEPLOY_INGRESS!"=="s" (
        kubectl apply -f "%SCRIPT_DIR%ingress.yaml"
        echo ✅ Ingress desplegado
    ) else (
        echo ⚠️  Ingress omitido
    )
)

REM Mostrar estado
echo.
echo 📊 Estado del despliegue:
echo ========================
kubectl get pods -n %NAMESPACE%
echo.
kubectl get services -n %NAMESPACE%
echo.
kubectl get pvc -n %NAMESPACE%

echo.
echo 🌐 Información de acceso:
echo ========================
echo.
echo ⚠️  Para obtener la URL de acceso, ejecuta:
echo    kubectl get svc whatsapp-app -n %NAMESPACE%
echo.
echo 💡 O usa port-forward para acceder localmente:
echo    kubectl port-forward svc/whatsapp-app 3000:3000 -n %NAMESPACE%
echo.

echo ✅ Despliegue completado!
echo.
echo 📖 Para más información, ver: docs\KUBERNETES_DEPLOYMENT.md
echo.
echo 🔍 Comandos útiles:
echo   Ver logs: kubectl logs -f deployment/whatsapp-app -n %NAMESPACE%
echo   Ver pods: kubectl get pods -n %NAMESPACE%
echo   Escalar: kubectl scale deployment/whatsapp-app --replicas=5 -n %NAMESPACE%
echo   Eliminar todo: kubectl delete namespace %NAMESPACE%

endlocal

