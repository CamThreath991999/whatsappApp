#!/bin/bash
# ==================================
# Script de Despliegue Kubernetes
# Sistema WhatsApp Masivo
# ==================================

set -e

NAMESPACE="whatsapp-masivo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Iniciando despliegue en Kubernetes..."
echo "📂 Directorio del proyecto: $PROJECT_ROOT"
echo "📦 Namespace: $NAMESPACE"
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar que kubectl está instalado
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl no está instalado. Por favor instálalo primero."
    exit 1
fi

print_success "kubectl encontrado"

# Verificar conexión al cluster
if ! kubectl cluster-info &> /dev/null; then
    print_error "No se puede conectar al cluster de Kubernetes."
    exit 1
fi

print_success "Conectado al cluster de Kubernetes"

# Crear namespace si no existe
echo ""
echo "📦 Creando namespace..."
kubectl create namespace "$NAMESPACE" 2>/dev/null || print_warning "Namespace ya existe"

# Aplicar secrets y configmap
echo ""
echo "🔐 Aplicando secrets y configmap..."
kubectl apply -f "$SCRIPT_DIR/secrets.yaml"
kubectl apply -f "$SCRIPT_DIR/configmap.yaml"
print_success "Secrets y ConfigMap aplicados"

# Crear script de inicialización MySQL
echo ""
echo "🗄️  Creando script de inicialización MySQL..."
if [ -f "$PROJECT_ROOT/database/schema.sql" ]; then
    kubectl create configmap mysql-init-script \
        --from-file=init.sql="$PROJECT_ROOT/database/schema.sql" \
        -n "$NAMESPACE" \
        2>/dev/null || print_warning "ConfigMap de MySQL ya existe (actualizando...)"
    kubectl create configmap mysql-init-script \
        --from-file=init.sql="$PROJECT_ROOT/database/schema.sql" \
        -n "$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -
    print_success "Script de inicialización MySQL creado"
else
    print_error "No se encontró database/schema.sql"
    exit 1
fi

# Desplegar MySQL
echo ""
echo "🗄️  Desplegando MySQL..."
kubectl apply -f "$SCRIPT_DIR/mysql.yaml"
print_success "MySQL desplegado"

# Desplegar Redis
echo ""
echo "📦 Desplegando Redis..."
kubectl apply -f "$SCRIPT_DIR/redis.yaml"
print_success "Redis desplegado"

# Esperar a que MySQL esté listo
echo ""
echo "⏳ Esperando a que MySQL esté listo..."
if kubectl wait --for=condition=ready pod -l app=whatsapp-mysql -n "$NAMESPACE" --timeout=300s 2>/dev/null; then
    print_success "MySQL está listo"
else
    print_warning "MySQL no está listo aún, continuando..."
fi

# Crear PersistentVolumes (si existen)
echo ""
echo "💾 Creando PersistentVolumes..."
if [ -f "$SCRIPT_DIR/pv-sessions-nfs.yaml" ]; then
    kubectl apply -f "$SCRIPT_DIR/pv-sessions-nfs.yaml"
    print_success "PV de sesiones creado"
else
    print_warning "No se encontró pv-sessions-nfs.yaml (saltando...)"
fi

if [ -f "$SCRIPT_DIR/pvc-adicionales.yaml" ]; then
    kubectl apply -f "$SCRIPT_DIR/pvc-adicionales.yaml"
    print_success "PVCs adicionales creados"
else
    print_warning "No se encontró pvc-adicionales.yaml (saltando...)"
fi

# Desplegar aplicación
echo ""
echo "🚀 Desplegando aplicación..."
kubectl apply -f "$SCRIPT_DIR/app.yaml"
print_success "Aplicación desplegada"

# (Opcional) Desplegar Ingress
if [ -f "$SCRIPT_DIR/ingress.yaml" ]; then
    echo ""
    echo "🌐 Desplegando Ingress..."
    read -p "¿Deseas desplegar Ingress? (s/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        kubectl apply -f "$SCRIPT_DIR/ingress.yaml"
        print_success "Ingress desplegado"
    else
        print_warning "Ingress omitido"
    fi
fi

# Mostrar estado
echo ""
echo "📊 Estado del despliegue:"
echo "========================"
kubectl get pods -n "$NAMESPACE"
echo ""
kubectl get services -n "$NAMESPACE"
echo ""
kubectl get pvc -n "$NAMESPACE"

# Obtener IP del servicio
echo ""
echo "🌐 Información de acceso:"
echo "========================"
SERVICE_TYPE=$(kubectl get svc whatsapp-app -n "$NAMESPACE" -o jsonpath='{.spec.type}' 2>/dev/null || echo "N/A")

if [ "$SERVICE_TYPE" = "LoadBalancer" ]; then
    EXTERNAL_IP=$(kubectl get svc whatsapp-app -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pendiente...")
    if [ "$EXTERNAL_IP" = "Pendiente..." ]; then
        print_warning "Esperando IP externa del LoadBalancer..."
        EXTERNAL_IP=$(kubectl get svc whatsapp-app -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "Pendiente...")
    fi
    echo "Tipo: LoadBalancer"
    echo "IP Externa: $EXTERNAL_IP"
    echo "URL: http://$EXTERNAL_IP:3000"
elif [ "$SERVICE_TYPE" = "NodePort" ]; then
    NODE_PORT=$(kubectl get svc whatsapp-app -n "$NAMESPACE" -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "N/A")
    NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || echo "N/A")
    echo "Tipo: NodePort"
    echo "Puerto: $NODE_PORT"
    echo "IP del Nodo: $NODE_IP"
    echo "URL: http://$NODE_IP:$NODE_PORT"
else
    print_warning "Tipo de servicio: $SERVICE_TYPE"
    print_warning "Accede usando port-forward: kubectl port-forward svc/whatsapp-app 3000:3000 -n $NAMESPACE"
fi

echo ""
print_success "Despliegue completado!"
echo ""
echo "📖 Para más información, ver: docs/KUBERNETES_DEPLOYMENT.md"
echo ""
echo "🔍 Comandos útiles:"
echo "  Ver logs: kubectl logs -f deployment/whatsapp-app -n $NAMESPACE"
echo "  Ver pods: kubectl get pods -n $NAMESPACE"
echo "  Escalar: kubectl scale deployment/whatsapp-app --replicas=5 -n $NAMESPACE"
echo "  Eliminar todo: kubectl delete namespace $NAMESPACE"

