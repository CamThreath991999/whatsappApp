# 📋 Pasos Completos para Desplegar Sistema WhatsApp Masivo
## Despliegue Multi-PC con Sesiones Compartidas

> **Repositorio GitHub:** https://github.com/CamThreath991999/whatsappApp

---

## 🎯 **Objetivo**

Desplegar el sistema en Kubernetes/Docker para que:
- ✅ Múltiples PCs puedan acceder al mismo sistema
- ✅ Una sesión de WhatsApp escaneada en una PC sea visible en todas las demás
- ✅ Todos puedan enviar mensajes desde la misma sesión
- ✅ Alta disponibilidad y escalabilidad

---

## 📋 **Tabla de Contenidos**

1. [Requisitos Previos](#1-requisitos-previos)
2. [Configuración del Servidor NFS](#2-configuración-del-servidor-nfs-sesiones-compartidas)
3. [Configuración de Kubernetes](#3-configuración-de-kubernetes)
4. [Clonar Repositorio desde GitHub](#4-clonar-repositorio-desde-github)
5. [Configurar Secretos y Variables](#5-configurar-secretos-y-variables)
6. [Construir y Subir Imagen Docker](#6-construir-y-subir-imagen-docker)
7. [Desplegar en Kubernetes](#7-desplegar-en-kubernetes)
8. [Verificar Despliegue](#8-verificar-despliegue)
9. [Acceso desde Múltiples PCs](#9-acceso-desde-múltiples-pcs)
10. [Verificar Sesiones Compartidas](#10-verificar-sesiones-compartidas)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. **Requisitos Previos**

### Software Necesario

- [ ] **Docker** instalado (para construir imágenes)
- [ ] **kubectl** instalado (cliente de Kubernetes)
- [ ] **Kubernetes cluster** configurado (mínimo 2 nodos)
- [ ] **Git** instalado (para clonar repositorio)
- [ ] **Acceso a Docker Hub** o registry privado (para subir imágenes)

### Hardware Mínimo

- **PC Servidor NFS**: RAM 2GB, CPU 2 cores, Disco 50GB
- **Nodos Kubernetes**: RAM 4GB cada uno, CPU 2 cores cada uno
- **Red**: Todas las PCs deben estar en la misma red o tener conectividad

---

## 2. **Configuración del Servidor NFS (Sesiones Compartidas)**

### 2.1 Elegir PC para Servidor NFS

Puede ser:
- Una PC dedicada
- Uno de los nodos del cluster Kubernetes
- Un servidor separado

### 2.2 Instalar NFS Server

**En Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y nfs-kernel-server
```

**En CentOS/RHEL:**
```bash
sudo yum install -y nfs-utils
sudo systemctl enable nfs-server
sudo systemctl start nfs-server
```

### 2.3 Crear Directorios Compartidos

```bash
# Crear directorios para sesiones y datos compartidos
sudo mkdir -p /mnt/nfs/whatsapp-sessions
sudo mkdir -p /mnt/nfs/whatsapp-uploads
sudo mkdir -p /mnt/nfs/whatsapp-downloads
sudo mkdir -p /mnt/nfs/whatsapp-chats

# Configurar permisos (permitir acceso desde pods de Kubernetes)
sudo chown nobody:nogroup /mnt/nfs/whatsapp-*
sudo chmod 777 /mnt/nfs/whatsapp-*
```

### 2.4 Configurar Exports de NFS

```bash
# Editar archivo de exports
sudo nano /etc/exports

# Agregar las siguientes líneas (ajustar IP del cluster o usar * para permitir todo):
/mnt/nfs/whatsapp-sessions *(rw,sync,no_subtree_check,no_root_squash)
/mnt/nfs/whatsapp-uploads *(rw,sync,no_subtree_check,no_root_squash)
/mnt/nfs/whatsapp-downloads *(rw,sync,no_subtree_check,no_root_squash)
/mnt/nfs/whatsapp-chats *(rw,sync,no_subtree_check,no_root_squash)

# Guardar y cerrar (Ctrl+X, luego Y, luego Enter)

# Aplicar configuración
sudo exportfs -ra
sudo systemctl restart nfs-kernel-server
sudo systemctl enable nfs-kernel-server

# Verificar que NFS está corriendo
sudo systemctl status nfs-kernel-server
```

### 2.5 Configurar Firewall

```bash
# Permitir tráfico NFS (puertos 111, 2049)
sudo ufw allow from 0.0.0.0/0 to any port 111
sudo ufw allow from 0.0.0.0/0 to any port 2049

# O si solo quieres permitir desde tu red local:
sudo ufw allow from 192.168.1.0/24 to any port 111
sudo ufw allow from 192.168.1.0/24 to any port 2049
```

### 2.6 Obtener IP del Servidor NFS

```bash
# Ver IP del servidor NFS
hostname -I
# o
ip addr show | grep "inet " | grep -v 127.0.0.1
```

**📝 Anotar esta IP** (ejemplo: `192.168.1.100`) - La necesitarás más adelante.

### 2.7 Verificar Acceso desde Nodos Kubernetes

```bash
# En cada nodo del cluster, instalar cliente NFS
sudo apt install -y nfs-common  # Ubuntu/Debian
# o
sudo yum install -y nfs-utils  # CentOS/RHEL

# Probar montaje (reemplazar IP_SERVIDOR_NFS)
sudo mount -t nfs IP_SERVIDOR_NFS:/mnt/nfs/whatsapp-sessions /mnt/test
ls /mnt/test
sudo umount /mnt/test
```

✅ **Si puedes ver el directorio, el NFS está configurado correctamente.**

---

## 3. **Configuración de Kubernetes**

### 3.1 Elegir Opción de Kubernetes

#### **Opción A: Docker Desktop (Windows/Mac - Más Fácil)**

1. Instalar Docker Desktop
2. Settings → Kubernetes → Enable Kubernetes
3. Esperar a que el estado sea "Running"
4. Verificar: `kubectl get nodes`

#### **Opción B: Minikube (Desarrollo/Pruebas)**

```bash
# Instalar Minikube
# Windows: choco install minikube
# Linux: https://minikube.sigs.k8s.io/docs/start/

# Iniciar cluster con 2 nodos
minikube start --nodes=2 --driver=virtualbox

# Verificar
kubectl get nodes
```

#### **Opción C: K3s (Recomendado para Múltiples PCs)**

```bash
# En PC Principal (Master):
curl -sfL https://get.k3s.io | sh -

# Verificar token
sudo cat /var/lib/rancher/k3s/server/node-token

# En PCs Adicionales (Workers):
curl -sfL https://get.k3s.io | K3S_URL=https://IP_MASTER:6443 K3S_TOKEN=TOKEN sh -

# Verificar
kubectl get nodes
```

#### **Opción D: Cluster en la Nube**

- **Google GKE**: `gcloud container clusters create ...`
- **AWS EKS**: `eksctl create cluster ...`
- **Azure AKS**: `az aks create ...`

### 3.2 Verificar Conexión

```bash
# Ver nodos
kubectl get nodes

# Verificar configuración
kubectl cluster-info
```

✅ **Si ves los nodos, Kubernetes está listo.**

---

## 4. **Clonar Repositorio desde GitHub**

### 4.1 Clonar Repositorio

```bash
# Ir a directorio donde quieres clonar
cd ~  # o el directorio que prefieras

# Clonar repositorio
git clone https://github.com/CamThreath991999/whatsappApp.git

# Entrar al directorio
cd whatsappApp

# Verificar estructura
ls -la
```

### 4.2 Verificar Archivos Necesarios

```bash
# Verificar que existen los manifiestos de Kubernetes
ls -la k8s/

# Deberías ver:
# - namespace.yaml
# - secrets.yaml
# - configmap.yaml
# - mysql.yaml
# - redis.yaml
# - pv-sessions-nfs.yaml
# - pvc-adicionales.yaml
# - app.yaml
# - ingress.yaml (opcional)
```

✅ **Si todos los archivos están presentes, continúa.**

---

## 5. **Configurar Secretos y Variables**

### 5.1 Editar Secrets

```bash
# Editar archivo de secrets
nano k8s/secrets.yaml
# o usar tu editor preferido: code, vim, etc.
```

**⚠️ IMPORTANTE**: Cambiar TODAS las contraseñas:

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
  REDIS_PASSWORD: ""  # Dejar vacío o poner password
```

**💡 Generar secretos seguros:**
```bash
# Generar JWT_SECRET aleatorio
openssl rand -base64 32

# Generar SESSION_SECRET aleatorio
openssl rand -base64 32
```

### 5.2 Configurar PersistentVolumes (IP del Servidor NFS)

```bash
# Editar archivo de PersistentVolumes
nano k8s/pv-sessions-nfs.yaml
```

**⚠️ CAMBIAR la IP del servidor NFS:**

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
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: 192.168.1.100  # ⚠️ CAMBIAR: IP de tu servidor NFS
    path: /mnt/nfs/whatsapp-sessions
```

```bash
# Editar también el archivo de PVCs adicionales
nano k8s/pvc-adicionales.yaml
```

**⚠️ CAMBIAR la IP del servidor NFS en TODOS los PersistentVolumes:**

```yaml
# Cambiar en todos:
nfs:
  server: 192.168.1.100  # ⚠️ CAMBIAR: IP de tu servidor NFS
  path: /mnt/nfs/whatsapp-sessions  # o uploads, downloads, chats según corresponda
```

### 5.3 Configurar Imagen Docker

```bash
# Editar deployment de la aplicación
nano k8s/app.yaml
```

**⚠️ CAMBIAR la imagen Docker:**

```yaml
containers:
- name: app
  image: tu-usuario/whatsapp-masivo:latest  # ⚠️ CAMBIAR: Tu imagen Docker
```

**Opciones:**
- Usar Docker Hub: `tu-usuario/whatsapp-masivo:latest`
- Usar GitHub Container Registry: `ghcr.io/camthreath991999/whatsappapp:latest`
- Usar registry privado: `registry.tu-dominio.com/whatsapp-masivo:latest`

### 5.4 (Opcional) Configurar Ingress

Si quieres usar un dominio personalizado:

```bash
nano k8s/ingress.yaml
```

Cambiar:
```yaml
host: whatsapp.tu-dominio.com  # ⚠️ CAMBIAR: Tu dominio
```

✅ **Guardar todos los cambios.**

---

## 6. **Construir y Subir Imagen Docker**

### 6.1 Construir Imagen Docker

```bash
# Estar en el directorio raíz del proyecto
cd ~/whatsappApp  # o donde hayas clonado

# Construir imagen
docker build -t tu-usuario/whatsapp-masivo:latest .

# Verificar que la imagen se creó
docker images | grep whatsapp-masivo
```

### 6.2 Subir Imagen a Registry

#### **Opción A: Docker Hub**

```bash
# Login a Docker Hub
docker login

# Subir imagen
docker push tu-usuario/whatsapp-masivo:latest

# Verificar
docker search tu-usuario/whatsapp-masivo
```

#### **Opción B: GitHub Container Registry**

```bash
# Login a GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u CamThreath991999 --password-stdin

# Tag imagen con formato de GHCR
docker tag tu-usuario/whatsapp-masivo:latest ghcr.io/camthreath991999/whatsappapp:latest

# Subir imagen
docker push ghcr.io/camthreath991999/whatsappapp:latest
```

#### **Opción C: Registry Privado**

```bash
# Login a registry privado
docker login registry.tu-dominio.com

# Tag y push
docker tag tu-usuario/whatsapp-masivo:latest registry.tu-dominio.com/whatsapp-masivo:latest
docker push registry.tu-dominio.com/whatsapp-masivo:latest
```

✅ **Imagen subida y disponible en el registry.**

---

## 7. **Desplegar en Kubernetes**

### 7.1 Crear Namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

### 7.2 Aplicar Secrets y ConfigMap

```bash
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
```

### 7.3 Crear ConfigMap de Inicialización MySQL

```bash
# Crear ConfigMap con el script SQL de inicialización
kubectl create configmap mysql-init-script \
  --from-file=init.sql=database/schema.sql \
  -n whatsapp-masivo
```

### 7.4 Desplegar MySQL

```bash
kubectl apply -f k8s/mysql.yaml

# Esperar a que MySQL esté listo
kubectl wait --for=condition=ready pod -l app=whatsapp-mysql -n whatsapp-masivo --timeout=300s

# Verificar
kubectl get pods -n whatsapp-masivo | grep mysql
```

### 7.5 Desplegar Redis

```bash
kubectl apply -f k8s/redis.yaml

# Verificar
kubectl get pods -n whatsapp-masivo | grep redis
```

### 7.6 Crear PersistentVolumes

```bash
# Crear PV y PVC para sesiones
kubectl apply -f k8s/pv-sessions-nfs.yaml

# Crear PVCs adicionales
kubectl apply -f k8s/pvc-adicionales.yaml

# Verificar
kubectl get pv -n whatsapp-masivo
kubectl get pvc -n whatsapp-masivo
```

### 7.7 Desplegar Aplicación

```bash
kubectl apply -f k8s/app.yaml

# Verificar que los pods estén corriendo
kubectl get pods -n whatsapp-masivo

# Ver logs
kubectl logs -f deployment/whatsapp-app -n whatsapp-masivo
```

### 7.8 (Opcional) Desplegar Ingress

```bash
# Solo si configuraste ingress.yaml
kubectl apply -f k8s/ingress.yaml
```

### 7.9 Usar Script Automatizado (Alternativa)

**Linux/Mac:**
```bash
chmod +x k8s/deploy.sh
./k8s/deploy.sh
```

**Windows:**
```cmd
k8s\deploy.bat
```

✅ **Sistema desplegado en Kubernetes.**

---

## 8. **Verificar Despliegue**

### 8.1 Ver Estado de Recursos

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

### 8.2 Verificar Health Checks

```bash
# Ver logs de la aplicación
kubectl logs -f deployment/whatsapp-app -n whatsapp-masivo

# Deberías ver:
# ✓ Conectado a MySQL
# ✓ Conectado a Redis
# ✓ Socket.IO configurado
# ✓ Servidor corriendo en puerto 3000
```

### 8.3 Obtener URL de Acceso

```bash
# Ver servicio
kubectl get svc whatsapp-app -n whatsapp-masivo

# Si es LoadBalancer:
kubectl get svc whatsapp-app -n whatsapp-masivo -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# Si es NodePort:
kubectl get svc whatsapp-app -n whatsapp-masivo -o jsonpath='{.spec.ports[0].nodePort}'
kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}'
```

**📝 Anotar la URL de acceso** (ejemplo: `http://192.168.1.100:30000`)

---

## 9. **Acceso desde Múltiples PCs**

### 9.1 PC 1: Configurar Sesión

1. **Abrir navegador** en cualquier PC en la misma red
2. **Ir a**: `http://IP_SERVICIO:PUERTO`
   - Ejemplo: `http://192.168.1.100:30000`
3. **Login**:
   - Usuario: `admin`
   - Contraseña: `admin123`
4. **Ir a Dispositivos** → **+ Nuevo Dispositivo**
5. **Nombre del dispositivo**: `Dispositivo Principal`
6. **Clic en Conectar**
7. **Escanear QR** con WhatsApp desde tu celular
8. **Esperar** a que aparezca "Conectado"

### 9.2 PC 2: Verificar Sesión Compartida

1. **Abrir navegador** en otra PC (misma red)
2. **Ir a**: `http://IP_SERVICIO:PUERTO` (misma URL que PC 1)
3. **Login**: admin / admin123
4. **Ir a Dispositivos**
5. **✅ Verificar** que aparece "Dispositivo Principal" con estado "Conectado"
6. **✅ Sesión compartida funcionando**

### 9.3 PC 3, 4, etc.: Acceso desde Otras PCs

- Repetir pasos de PC 2
- Todas verán las mismas sesiones
- Todas pueden enviar mensajes desde las mismas sesiones

---

## 10. **Verificar Sesiones Compartidas**

### 10.1 Probar Envío de Mensajes

**Desde PC 1:**
1. Ir a **Envío Manual**
2. Seleccionar **Dispositivo Principal**
3. Ingresar número: `51999888777` (tu propio número para probar)
4. Escribir mensaje: `Prueba desde PC 1`
5. **Clic en Enviar Mensajes**

**Desde PC 2:**
1. Ir a **Chats**
2. Seleccionar **Dispositivo Principal**
3. **✅ Verificar** que aparece el mensaje enviado desde PC 1

**Desde PC 3:**
1. Ir a **Envío Manual**
2. Seleccionar **Dispositivo Principal** (misma sesión)
3. Ingresar número: `51999888777`
4. Escribir mensaje: `Prueba desde PC 3`
5. **Clic en Enviar Mensajes**

**✅ Si ambos mensajes se envían desde la misma sesión, todo funciona correctamente.**

### 10.2 Verificar Almacenamiento Compartido

```bash
# Verificar que los pods están usando el mismo volumen
kubectl exec -it whatsapp-app-xxxxx -n whatsapp-masivo -- ls -la /app/sessions

# Deberías ver las carpetas de sesiones

# Verificar desde otro pod
kubectl exec -it whatsapp-app-yyyyy -n whatsapp-masivo -- ls -la /app/sessions

# Deberías ver las mismas carpetas
```

---

## 11. **Troubleshooting**

### Problema: Pods no inician

```bash
# Ver eventos
kubectl describe pod whatsapp-app-xxxxx -n whatsapp-masivo

# Ver logs
kubectl logs whatsapp-app-xxxxx -n whatsapp-masivo

# Verificar recursos
kubectl top pods -n whatsapp-masivo
```

### Problema: PVC en estado Pending

```bash
# Ver detalles del PVC
kubectl describe pvc whatsapp-sessions-pvc -n whatsapp-masivo

# Verificar que el PV existe
kubectl get pv whatsapp-sessions-pv

# Verificar acceso NFS desde nodos
# En cada nodo:
sudo mount -t nfs IP_SERVIDOR_NFS:/mnt/nfs/whatsapp-sessions /mnt/test
```

### Problema: No puedo acceder desde otra PC

```bash
# Verificar que el servicio está expuesto
kubectl get svc whatsapp-app -n whatsapp-masivo

# Verificar firewall
sudo ufw status

# Probar desde el mismo nodo
curl http://localhost:PUERTO
```

### Problema: Sesiones no se comparten

```bash
# Verificar que PVC tiene ReadWriteMany
kubectl get pvc whatsapp-sessions-pvc -n whatsapp-masivo -o yaml | grep accessModes

# Verificar montaje en pods
kubectl exec whatsapp-app-xxxxx -n whatsapp-masivo -- df -h | grep sessions

# Verificar permisos NFS
kubectl exec whatsapp-app-xxxxx -n whatsapp-masivo -- ls -la /app/sessions
```

### Problema: Base de datos no conecta

```bash
# Verificar que MySQL está corriendo
kubectl get pods -n whatsapp-masivo | grep mysql

# Ver logs de MySQL
kubectl logs whatsapp-mysql-0 -n whatsapp-masivo

# Probar conexión desde pod de la app
kubectl exec -it whatsapp-app-xxxxx -n whatsapp-masivo -- sh
mysql -h whatsapp-mysql -u whatsapp_user -p
```

---

## ✅ **Checklist Final**

- [ ] Servidor NFS configurado y funcionando
- [ ] Kubernetes cluster configurado (mínimo 2 nodos)
- [ ] Repositorio clonado desde GitHub
- [ ] Secrets editados (contraseñas cambiadas)
- [ ] PersistentVolumes configurados (IP NFS correcta)
- [ ] Imagen Docker construida y subida
- [ ] app.yaml editado (imagen correcta)
- [ ] Todos los recursos desplegados
- [ ] Pods corriendo y saludables
- [ ] Servicio accesible desde red
- [ ] Sesión de WhatsApp creada
- [ ] Sesión visible desde múltiples PCs
- [ ] Mensajes se envían desde múltiples PCs
- [ ] Verificado que todas las PCs usan la misma sesión

---

## 🎉 **¡Sistema Desplegado!**

Ahora tienes:
- ✅ Sistema accesible desde múltiples PCs
- ✅ Sesiones de WhatsApp compartidas
- ✅ Alta disponibilidad (múltiples réplicas)
- ✅ Escalabilidad horizontal
- ✅ Persistencia de datos

**Todas las PCs pueden:**
- Ver las mismas sesiones de WhatsApp
- Enviar mensajes desde las mismas sesiones
- Ver los mismos chats
- Gestionar las mismas campañas

---

## 📖 **Documentación Adicional**

- **Guía Completa Kubernetes**: `docs/KUBERNETES_DEPLOYMENT.md`
- **Guía Rápida**: `docs/GUIA_RAPIDA_KUBERNETES.md`
- **Docker Compose**: `docs/DOCKER_DEPLOYMENT.md`
- **Multi-PC sin Kubernetes**: `docs/DESPLIEGUE_MULTI_PC.md`
- **Índice Completo**: `docs/INDICE_DOCUMENTACION.md`

---

## 🔧 **Comandos Útiles de Referencia**

```bash
# Ver estado
kubectl get all -n whatsapp-masivo

# Ver logs
kubectl logs -f deployment/whatsapp-app -n whatsapp-masivo

# Escalar aplicación
kubectl scale deployment/whatsapp-app --replicas=5 -n whatsapp-masivo

# Actualizar imagen
kubectl set image deployment/whatsapp-app app=tu-usuario/whatsapp-masivo:v2.0 -n whatsapp-masivo

# Reiniciar pods
kubectl rollout restart deployment/whatsapp-app -n whatsapp-masivo

# Eliminar todo (CUIDADO)
kubectl delete namespace whatsapp-masivo
```

---

**🎯 Repositorio:** https://github.com/CamThreath991999/whatsappApp

