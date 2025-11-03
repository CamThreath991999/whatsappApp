# 🚀 Guía Rápida: Desplegar en Kubernetes Multi-PC

> **Objetivo**: Acceder desde distintas PC usando una sola sesión/conexión de WhatsApp

---

## 📋 Tabla de Contenidos

1. [Prerrequisitos](#prerrequisitos)
2. [Preparar Servidor NFS](#preparar-servidor-nfs)
3. [Configurar Kubernetes](#configurar-kubernetes)
4. [Editar Archivos Clave](#editar-archivos-clave)
5. [Construir y Subir Imagen Docker](#construir-y-subir-imagen-docker)
6. [Desplegar Sistema](#desplegar-sistema)
7. [Verificar y Probar](#verificar-y-probar)
8. [Acceder desde Múltiples PCs](#acceder-desde-múltiples-pcs)
9. [Comandos Útiles](#comandos-útiles)
10. [Solución de Problemas](#solución-de-problemas)

---

## 🔧 Prerrequisitos

### Software Necesario

```bash
# Verificar instalaciones
docker --version
kubectl version --client
git --version

# Si no tienes kubectl:
# Windows: choco install kubernetes-cli
# Linux/Mac: https://kubernetes.io/docs/tasks/tools/
```

### Hardware Mínimo

- **PC Servidor NFS**: 2GB RAM, 2 CPUs, 50GB disco
- **Cluster Kubernetes**: 2+ nodos con 4GB RAM cada uno
- **Red**: Todas las PCs en la misma red

---

## 📦 Paso 1: Preparar Servidor NFS

> **CRÍTICO**: Sin NFS, no puedes compartir sesiones entre múltiples pods

### 1.1 Instalar NFS Server (Ubuntu/Debian)

```bash
# En la PC que será servidor NFS
sudo apt update
sudo apt install -y nfs-kernel-server

# Crear directorios compartidos
sudo mkdir -p /mnt/nfs/whatsapp-sessions
sudo mkdir -p /mnt/nfs/whatsapp-uploads
sudo mkdir -p /mnt/nfs/whatsapp-downloads
sudo mkdir -p /mnt/nfs/whatsapp-chats

# Configurar permisos
sudo chown nobody:nogroup /mnt/nfs/whatsapp-*
sudo chmod 777 /mnt/nfs/whatsapp-*
```

### 1.2 Configurar Exports de NFS

```bash
# Editar exports
sudo nano /etc/exports

# Agregar estas líneas:
/mnt/nfs/whatsapp-sessions *(rw,sync,no_subtree_check,no_root_squash)
/mnt/nfs/whatsapp-uploads *(rw,sync,no_subtree_check,no_root_squash)
/mnt/nfs/whatsapp-downloads *(rw,sync,no_subtree_check,no_root_squash)
/mnt/nfs/whatsapp-chats *(rw,sync,no_subtree_check,no_root_squash)

# Guardar (Ctrl+X, Y, Enter)

# Aplicar configuración
sudo exportfs -ra
sudo systemctl restart nfs-kernel-server
sudo systemctl enable nfs-kernel-server

# Verificar
showmount -e localhost
```

### 1.3 Configurar Firewall

```bash
# Permitir tráfico NFS
sudo ufw allow from any to any port 111
sudo ufw allow from any to any port 2049
```

### 1.4 Obtener IP del Servidor NFS

```bash
hostname -I
# Anota esta IP (ejemplo: 192.168.1.100) ⚠️ LA NECESITARÁS MÁS ADELANTE
```

### 1.5 Instalar Cliente NFS en Nodos Kubernetes

```bash
# En CADA nodo del cluster
sudo apt install -y nfs-common

# Probar montaje (reemplazar IP_SERVIDOR_NFS)
sudo mount -t nfs IP_SERVIDOR_NFS:/mnt/nfs/whatsapp-sessions /mnt/test
ls /mnt/test
sudo umount /mnt/test
```

✅ **Si funciona, NFS está listo**

---

## ☸️ Paso 2: Configurar Kubernetes

### Opción A: Docker Desktop (Más Fácil para Windows/Mac)

```bash
# 1. Instalar Docker Desktop
# 2. Settings → Kubernetes → Enable Kubernetes
# 3. Esperar "Running"

# Verificar
kubectl get nodes
```

### Opción B: Minikube (Desarrollo)

```bash
# Instalar Minikube
# https://minikube.sigs.k8s.io/docs/start/

# Iniciar cluster
minikube start --nodes=2 --driver=virtualbox

# Verificar
kubectl get nodes
```

### Opción C: K3s (Recomendado Multi-PC)

```bash
# PC Principal (Master)
curl -sfL https://get.k3s.io | sh -

# Obtener token
sudo cat /var/lib/rancher/k3s/server/node-token

# PCs Adicionales (Workers)
# Reemplazar IP_MASTER y TOKEN con valores reales
curl -sfL https://get.k3s.io | K3S_URL=https://IP_MASTER:6443 K3S_TOKEN=TOKEN sh -

# Verificar
kubectl get nodes
```

---

## ✏️ Paso 3: Editar Archivos Clave

### 3.1 Editar Secrets

```bash
nano k8s/secrets.yaml
```

**⚠️ CAMBIAR todas las contraseñas:**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: whatsapp-secrets
  namespace: whatsapp-masivo
type: Opaque
stringData:
  MYSQL_ROOT_PASSWORD: TU_PASSWORD_MYSQL_ROOT_SEGURO  # ⚠️ CAMBIAR
  MYSQL_PASSWORD: TU_PASSWORD_MYSQL_USUARIO_SEGURO     # ⚠️ CAMBIAR
  JWT_SECRET: TU_SECRETO_JWT_MUY_LARGO_Y_ALEATORIO      # ⚠️ CAMBIAR (min 32 chars)
  SESSION_SECRET: TU_SECRETO_SESSION_MUY_LARGO_Y_ALEATORIO  # ⚠️ CAMBIAR (min 32 chars)
  REDIS_PASSWORD: ""
```

**Generar secretos seguros:**

```bash
openssl rand -base64 32  # Usar esto para JWT_SECRET y SESSION_SECRET
```

### 3.2 Editar PersistentVolumes (IP del NFS)

```bash
nano k8s/pv-sessions-nfs.yaml
```

**⚠️ CAMBIAR IP del servidor NFS:**

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: whatsapp-sessions-pv
  namespace: whatsapp-masivo
spec:
  capacity:
    storage: 50Gi
  accessModes:
    - ReadWriteMany  # CRÍTICO: Permite múltiples pods
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: 192.168.1.100  # ⚠️ CAMBIAR: IP de tu servidor NFS
    path: /mnt/nfs/whatsapp-sessions
```

```bash
nano k8s/pvc-adicionales.yaml
```

**⚠️ CAMBIAR IP del servidor NFS en TODOS los PersistentVolumes:**

Busca y reemplaza `192.168.1.100` por tu IP de NFS en:
- `whatsapp-uploads-pv`
- `whatsapp-downloads-pv`
- `whatsapp-chats-pv`

### 3.3 Editar Imagen Docker

```bash
nano k8s/app.yaml
```

**⚠️ CAMBIAR imagen Docker (línea ~37):**

```yaml
containers:
- name: app
  image: tu-usuario/whatsapp-masivo:latest  # ⚠️ CAMBIAR: Tu imagen Docker
```

**Opciones:**
- Docker Hub: `tu-usuario/whatsapp-masivo:latest`
- GitHub Container Registry: `ghcr.io/camthreath991999/whatsappapp:latest`

---

## 🐳 Paso 4: Construir y Subir Imagen Docker

### 4.1 Construir Imagen

```bash
# Estar en directorio raíz del proyecto
cd c:\Users\casa\Documents\proyecto3\expressDb

# Construir imagen
docker build -t tu-usuario/whatsapp-masivo:latest .

# Verificar
docker images | grep whatsapp-masivo
```

### 4.2 Subir Imagen a Registry

#### Docker Hub

```bash
# Login
docker login

# Subir
docker push tu-usuario/whatsapp-masivo:latest
```

#### GitHub Container Registry

```bash
# Login
echo $GITHUB_TOKEN | docker login ghcr.io -u CamThreath991999 --password-stdin

# Tag
docker tag tu-usuario/whatsapp-masivo:latest ghcr.io/camthreath991999/whatsappapp:latest

# Push
docker push ghcr.io/camthreath991999/whatsappapp:latest
```

---

## 🚀 Paso 5: Desplegar Sistema

### 5.1 Crear Namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

### 5.2 Aplicar Secrets y ConfigMap

```bash
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
```

### 5.3 Crear ConfigMap MySQL Init

```bash
kubectl create configmap mysql-init-script \
  --from-file=init.sql=database/schema.sql \
  -n whatsapp-masivo
```

### 5.4 Desplegar MySQL

```bash
kubectl apply -f k8s/mysql.yaml

# Esperar a que MySQL esté listo
kubectl wait --for=condition=ready pod -l app=whatsapp-mysql -n whatsapp-masivo --timeout=300s

# Verificar
kubectl get pods -n whatsapp-masivo | grep mysql
```

### 5.5 Desplegar Redis

```bash
kubectl apply -f k8s/redis.yaml

# Verificar
kubectl get pods -n whatsapp-masivo | grep redis
```

### 5.6 Crear PersistentVolumes

```bash
# PV para sesiones
kubectl apply -f k8s/pv-sessions-nfs.yaml

# PVCs adicionales
kubectl apply -f k8s/pvc-adicionales.yaml

# Verificar
kubectl get pv -n whatsapp-masivo
kubectl get pvc -n whatsapp-masivo
```

### 5.7 Desplegar Aplicación

```bash
kubectl apply -f k8s/app.yaml

# Verificar pods
kubectl get pods -n whatsapp-masivo

# Ver logs
kubectl logs -f deployment/whatsapp-app -n whatsapp-masivo
```

### 5.8 Usar Script Automatizado (Alternativa)

**Windows:**
```cmd
k8s\deploy.bat
```

**Linux/Mac:**
```bash
chmod +x k8s/deploy.sh
./k8s/deploy.sh
```

---

## ✅ Paso 6: Verificar Despliegue

### 6.1 Ver Estado de Recursos

```bash
# Ver todos los recursos
kubectl get all -n whatsapp-masivo

# Ver pods
kubectl get pods -n whatsapp-masivo

# Ver servicios
kubectl get svc -n whatsapp-masivo

# Ver PVCs
kubectl get pvc -n whatsapp-masivo
```

### 6.2 Ver Logs

```bash
# Logs de la aplicación
kubectl logs -f deployment/whatsapp-app -n whatsapp-masivo

# Deberías ver:
# ✓ Conectado a MySQL
# ✓ Conectado a Redis
# ✓ Socket.IO configurado
# ✓ Servidor corriendo en puerto 3000
```

### 6.3 Obtener URL de Acceso

```bash
# Ver servicio
kubectl get svc whatsapp-app -n whatsapp-masivo

# Si es LoadBalancer:
kubectl get svc whatsapp-app -n whatsapp-masivo -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# Si es NodePort:
kubectl get svc whatsapp-app -n whatsapp-masivo -o jsonpath='{.spec.ports[0].nodePort}'
kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}'
```

**📝 Anotar URL de acceso** (ejemplo: `http://192.168.1.100:30000`)

---

## 💻 Paso 7: Acceder desde Múltiples PCs

### 7.1 PC 1: Crear Sesión WhatsApp

1. Abrir navegador: `http://IP_SERVICIO:PUERTO`
2. Login: `admin` / `admin123`
3. Ir a **Dispositivos** → **+ Nuevo Dispositivo**
4. Nombre: `Dispositivo Principal`
5. Clic en **Conectar**
6. **Escanear QR** con WhatsApp
7. Esperar "Conectado"

### 7.2 PC 2: Verificar Sesión Compartida

1. Abrir navegador: `http://IP_SERVICIO:PUERTO` (misma URL)
2. Login: `admin` / `admin123`
3. Ir a **Dispositivos**
4. **✅ Verificar**: Aparece "Dispositivo Principal" - Estado: "Conectado"
5. **✅ Sesión compartida funcionando**

### 7.3 PC 3, 4, etc.: Acceder

- Repetir pasos de PC 2
- Todas verán las mismas sesiones
- Todas pueden enviar mensajes desde las mismas sesiones

### 7.4 Probar Envío desde Múltiples PCs

**Desde PC 1:**
1. Ir a **Envío Manual**
2. Seleccionar **Dispositivo Principal**
3. Número: `51999888777` (tu número)
4. Mensaje: `Prueba desde PC 1`
5. Clic en **Enviar Mensajes**

**Desde PC 2:**
1. Ir a **Chats**
2. Seleccionar **Dispositivo Principal**
3. **✅ Ver**: Mensaje enviado desde PC 1

**Desde PC 3:**
1. Ir a **Envío Manual**
2. Seleccionar **Dispositivo Principal** (misma sesión)
3. Número: `51999888777`
4. Mensaje: `Prueba desde PC 3`
5. Clic en **Enviar Mensajes**

**✅ Si ambos mensajes se envían desde la misma sesión, todo funciona**

---

## 🛠️ Paso 8: Comandos Útiles

### Ver Estado

```bash
# Ver todos los recursos
kubectl get all -n whatsapp-masivo

# Ver pods
kubectl get pods -n whatsapp-masivo

# Ver logs
kubectl logs -f deployment/whatsapp-app -n whatsapp-masivo
```

### Escalar Aplicación

```bash
# Aumentar réplicas
kubectl scale deployment whatsapp-app --replicas=5 -n whatsapp-masivo

# Ver réplicas
kubectl get deployment whatsapp-app -n whatsapp-masivo
```

### Actualizar Aplicación

```bash
# 1. Construir nueva imagen
docker build -t tu-usuario/whatsapp-masivo:v2.0 .

# 2. Push
docker push tu-usuario/whatsapp-masivo:v2.0

# 3. Actualizar deployment
kubectl set image deployment/whatsapp-app \
  app=tu-usuario/whatsapp-masivo:v2.0 \
  -n whatsapp-masivo

# 4. Ver rollout
kubectl rollout status deployment/whatsapp-app -n whatsapp-masivo

# 5. Rollback si hay problemas
kubectl rollout undo deployment/whatsapp-app -n whatsapp-masivo
```

### Reiniciar Pods

```bash
kubectl rollout restart deployment/whatsapp-app -n whatsapp-masivo
```

### Acceder a Pod

```bash
# Ejecutar shell en pod
kubectl exec -it whatsapp-app-xxxxx -n whatsapp-masivo -- sh

# Ver archivos
kubectl exec whatsapp-app-xxxxx -n whatsapp-masivo -- ls -la /app/sessions
```

### Backups

```bash
# Backup MySQL
kubectl exec whatsapp-mysql-0 -n whatsapp-masivo -- \
  mysqldump -u root -pwhatsapp_root_2025 whatsapp_masivo > backup_$(date +%Y%m%d).sql

# Backup sesiones (desde servidor NFS)
sudo tar czf sessions_backup_$(date +%Y%m%d).tar.gz /mnt/nfs/whatsapp-sessions
```

### Limpiar Todo

```bash
# ⚠️ CUIDADO: Borra todo
kubectl delete namespace whatsapp-masivo
```

---

## 🔧 Paso 9: Solución de Problemas

### Pods no inician

```bash
# Ver eventos
kubectl describe pod whatsapp-app-xxxxx -n whatsapp-masivo

# Ver logs
kubectl logs whatsapp-app-xxxxx -n whatsapp-masivo

# Ver recursos
kubectl top pods -n whatsapp-masivo
```

### PVC en estado Pending

```bash
# Ver detalles PVC
kubectl describe pvc whatsapp-sessions-pvc -n whatsapp-masivo

# Verificar PV existe
kubectl get pv whatsapp-sessions-pv

# Verificar NFS desde nodos
sudo mount -t nfs IP_SERVIDOR_NFS:/mnt/nfs/whatsapp-sessions /mnt/test
```

### No puedo acceder desde otra PC

```bash
# Verificar servicio
kubectl get svc whatsapp-app -n whatsapp-masivo

# Verificar firewall
sudo ufw status

# Probar desde el mismo nodo
curl http://localhost:PUERTO
```

### Sesiones no se comparten

```bash
# Verificar PVC tiene ReadWriteMany
kubectl get pvc whatsapp-sessions-pvc -n whatsapp-masivo -o yaml | grep accessModes

# Verificar montaje en pods
kubectl exec whatsapp-app-xxxxx -n whatsapp-masivo -- df -h | grep sessions

# Verificar permisos NFS
kubectl exec whatsapp-app-xxxxx -n whatsapp-masivo -- ls -la /app/sessions
```

### Base de datos no conecta

```bash
# Verificar MySQL corriendo
kubectl get pods -n whatsapp-masivo | grep mysql

# Ver logs MySQL
kubectl logs whatsapp-mysql-0 -n whatsapp-masivo

# Probar conexión
kubectl exec -it whatsapp-app-xxxxx -n whatsapp-masivo -- sh
mysql -h whatsapp-mysql -u whatsapp_user -p
```

---

## ✅ Checklist Final

- [ ] Servidor NFS configurado y funcionando
- [ ] Kubernetes cluster configurado (2+ nodos)
- [ ] Cliente NFS instalado en todos los nodos
- [ ] Secrets editados (contraseñas cambiadas)
- [ ] PersistentVolumes configurados (IP NFS correcta)
- [ ] Imagen Docker construida y subida
- [ ] app.yaml editado (imagen correcta)
- [ ] Todos los recursos desplegados
- [ ] Pods corriendo y saludables
- [ ] Servicio accesible desde red
- [ ] Sesión WhatsApp creada
- [ ] Sesión visible desde múltiples PCs
- [ ] Mensajes se envían desde múltiples PCs
- [ ] Verificado que todas las PCs usan la misma sesión

---

## 🎉 ¡Listo!

Ahora tienes:
- ✅ Sistema accesible desde múltiples PCs
- ✅ Sesiones de WhatsApp compartidas (1 sesión para todas las PCs)
- ✅ Alta disponibilidad (múltiples réplicas)
- ✅ Escalabilidad horizontal
- ✅ Persistencia de datos

**Todas las PCs pueden:**
- Ver las mismas sesiones de WhatsApp
- Enviar mensajes desde las mismas sesiones
- Ver los mismos chats
- Gestionar las mismas campañas

---

## 📚 Documentación Adicional

- **Guía Completa Kubernetes**: `docs/KUBERNETES_DEPLOYMENT.md`
- **Pasos Completos**: `docs/PASOS_COMPLETOS_DESPLIEGUE.md`
- **NFS Setup**: `docs/PASO1_CONFIGURAR_NFS.md`
- **Docker Compose**: `docs/DOCKER_DEPLOYMENT.md`
- **Multi-PC sin Kubernetes**: `docs/DESPLIEGUE_MULTI_PC.md`

---

**🎯 Comandos de Referencia Rápida:**

```bash
# Ver estado
kubectl get all -n whatsapp-masivo

# Ver logs
kubectl logs -f deployment/whatsapp-app -n whatsapp-masivo

# Escalar
kubectl scale deployment/whatsapp-app --replicas=3 -n whatsapp-masivo

# Actualizar
kubectl set image deployment/whatsapp-app app=imagen:version -n whatsapp-masivo

# Reiniciar
kubectl rollout restart deployment/whatsapp-app -n whatsapp-masivo
```

