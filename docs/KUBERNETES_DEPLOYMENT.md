# 🚀 Guía de Despliegue Kubernetes - Sistema WhatsApp Masivo
## Despliegue Multi-PC con Sesiones Compartidas

---

## 📋 **Tabla de Contenidos**

1. [Arquitectura Kubernetes](#arquitectura-kubernetes)
2. [Requisitos Previos](#requisitos-previos)
3. [Configuración de Almacenamiento Compartido](#configuración-de-almacenamiento-compartido)
4. [Configuración de Secretos y ConfigMaps](#configuración-de-secretos-y-configmaps)
5. [Despliegue de Servicios Base](#despliegue-de-servicios-base)
6. [Despliegue de la Aplicación](#despliegue-de-la-aplicación)
7. [Configuración de Acceso](#configuración-de-acceso)
8. [Verificación y Pruebas](#verificación-y-pruebas)
9. [Troubleshooting](#troubleshooting)
10. [Mantenimiento y Escalado](#mantenimiento-y-escalado)

---

## 🏗️ **Arquitectura Kubernetes**

### Concepto

Este sistema permite desplegar la aplicación en **múltiples nodos de Kubernetes** compartiendo:
- ✅ **Base de datos MySQL** (centralizada)
- ✅ **Sesiones de WhatsApp** (archivos compartidos via PersistentVolume)
- ✅ **Cache Redis** (compartido)
- ✅ **Escalabilidad horizontal** (múltiples réplicas del pod)

### Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                       │
│                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐ │
│  │   PC/Nodo 1  │     │   PC/Nodo 2  │     │  PC/Nodo 3  │ │
│  │              │     │              │     │             │ │
│  │ ┌──────────┐ │     │ ┌──────────┐ │     │ ┌─────────┐ │ │
│  │ │ App Pod  │ │     │ │ App Pod  │ │     │ │ App Pod │ │ │
│  │ │ (Pod 1)  │ │     │ │ (Pod 2)  │ │     │ │ (Pod 3) │ │ │
│  │ └────┬─────┘ │     │ └────┬─────┘ │     │ └────┬────┘ │ │
│  └──────┼───────┘     └──────┼───────┘     └─────┼──────┘ │ │
│         │                    │                    │        │ │
│         └────────────────────┼────────────────────┘        │ │
│                              │                             │ │
│         ┌────────────────────▼────────────────────┐        │ │
│         │     PersistentVolume (Sesiones)         │        │ │
│         │         ReadWriteMany (NFS)              │        │ │
│         └────────────────────┬────────────────────┘        │ │
│                              │                             │ │
│  ┌───────────────────────────┼──────────────────────────┐ │ │
│  │           ┌───────────────▼───────────────┐          │ │ │
│  │           │     MySQL StatefulSet         │          │ │ │
│  │           │   (Base de Datos Persistente) │          │ │ │
│  │           └───────────────┬───────────────┘          │ │ │
│  │                           │                           │ │ │
│  │           ┌───────────────▼───────────────┐          │ │ │
│  │           │    Redis Deployment           │          │ │ │
│  │           │    (Cache Compartido)         │          │ │ │
│  │           └───────────────────────────────┘          │ │ │
│  └─────────────────────────────────────────────────────┘ │ │
│                                                          │ │
│  ┌─────────────────────────────────────────────────────┐ │ │
│  │            Service (Load Balancer)                  │ │ │
│  │        http://IP_SERVICIO:3000                      │ │ │
│  └─────────────────────────────────────────────────────┘ │ │
└───────────────────────────────────────────────────────────┘
```

---

## 💻 **Requisitos Previos**

### 1. **Kubernetes Cluster**

Tienes **3 opciones** principales:

#### **Opción A: Kubernetes en Producción (Recomendado)**
- Cluster de Kubernetes en la nube (GKE, EKS, AKS)
- O cluster on-premise con mínimo 3 nodos

#### **Opción B: Minikube (Desarrollo/Pruebas)**
```bash
# Instalar Minikube
# Windows: choco install minikube
# Linux: curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64

# Iniciar cluster
minikube start --nodes=2 --driver=virtualbox
```

#### **Opción C: K3s (Lightweight, Recomendado para múltiples PCs)**
```bash
# En PC principal (servidor)
curl -sfL https://get.k3s.io | sh -

# En PCs adicionales (workers)
curl -sfL https://get.k3s.io | K3S_URL=https://IP_SERVIDOR:6443 K3S_TOKEN=TOKEN sh -
```

### 2. **kubectl Instalado**

```bash
# Verificar instalación
kubectl version --client

# Configurar acceso al cluster
kubectl config get-contexts
```

### 3. **Docker Desktop con Kubernetes (Opción Fácil para Windows)**

1. Instalar Docker Desktop
2. Habilitar Kubernetes en Settings → Kubernetes
3. Esperar a que el cluster esté listo

### 4. **Almacenamiento Compartido**

**IMPORTANTE**: Las sesiones de WhatsApp se guardan como archivos. Para compartirlas entre múltiples pods, necesitas un storage que soporte `ReadWriteMany`:

#### **Opciones de Storage:**

1. **NFS Server** (Recomendado para on-premise)
2. **CephFS** (Si tienes Ceph)
3. **Cloud Storage** (GCE PersistentDisk con NFS, AWS EFS, Azure Files)
4. **HostPath** (Solo para desarrollo, NO para producción multi-nodo)

---

## 📦 **Paso 1: Configuración de Almacenamiento Compartido**

### **Opción A: NFS Server (On-Premise)**

#### 1.1 Instalar NFS Server (En PC/Servidor dedicado)

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install -y nfs-kernel-server

# Crear directorio compartido
sudo mkdir -p /mnt/nfs/whatsapp-sessions
sudo chown nobody:nogroup /mnt/nfs/whatsapp-sessions
sudo chmod 777 /mnt/nfs/whatsapp-sessions

# Configurar exportaciones
echo "/mnt/nfs/whatsapp-sessions *(rw,sync,no_subtree_check,no_root_squash)" | sudo tee -a /etc/exports

# Reiniciar NFS
sudo exportfs -ra
sudo systemctl restart nfs-kernel-server
sudo systemctl enable nfs-kernel-server

# Verificar
showmount -e localhost
```

**Windows (con WSL2 o usar NFS en Linux):**
- Usar una máquina Linux como servidor NFS

#### 1.2 Instalar NFS Client en Nodos Kubernetes

```bash
# En cada nodo del cluster
sudo apt install -y nfs-common  # Linux
```

### **Opción B: Usar Storage Class Existente (Cloud)**

Si usas un cluster en la nube, usa el storage class proporcionado:
- **GKE**: `standard-rwo` o crear NFS con `Filestore`
- **EKS**: `efs.csi.aws.com` (AWS EFS)
- **AKS**: `azurefile-csi` (Azure Files)

---

## 🔐 **Paso 2: Configuración de Secretos y ConfigMaps**

### 2.1 Crear Namespace

```bash
kubectl create namespace whatsapp-masivo
```

### 2.2 Crear Secretos

Crear archivo `k8s/secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: whatsapp-secrets
  namespace: whatsapp-masivo
type: Opaque
stringData:
  MYSQL_ROOT_PASSWORD: whatsapp_root_2025_CHANGE_THIS
  MYSQL_PASSWORD: whatsapp_pass_2025_CHANGE_THIS
  JWT_SECRET: change_this_jwt_secret_in_production
  SESSION_SECRET: change_this_session_secret_in_production
  REDIS_PASSWORD: ""  # Dejar vacío si no usas password
```

**Aplicar:**
```bash
kubectl apply -f k8s/secrets.yaml
```

⚠️ **IMPORTANTE**: Cambiar todas las contraseñas antes de desplegar en producción.

### 2.3 Crear ConfigMap

Crear archivo `k8s/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: whatsapp-config
  namespace: whatsapp-masivo
data:
  MYSQL_DATABASE: "whatsapp_masivo"
  MYSQL_USER: "whatsapp_user"
  DB_HOST: "whatsapp-mysql"
  DB_PORT: "3306"
  DB_NAME: "whatsapp_masivo"
  REDIS_HOST: "whatsapp-redis"
  REDIS_PORT: "6379"
  PORT: "3000"
  NODE_ENV: "production"
  PYTHON_SERVICE_URL: "http://localhost:5000"
```

**Aplicar:**
```bash
kubectl apply -f k8s/configmap.yaml
```

---

## 🗄️ **Paso 3: Despliegue de Servicios Base**

### 3.1 MySQL StatefulSet

Crear archivo `k8s/mysql.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: whatsapp-mysql
  namespace: whatsapp-masivo
spec:
  selector:
    app: whatsapp-mysql
  ports:
    - port: 3306
      targetPort: 3306
  clusterIP: None  # Headless service para StatefulSet
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: whatsapp-mysql
  namespace: whatsapp-masivo
spec:
  serviceName: whatsapp-mysql
  replicas: 1
  selector:
    matchLabels:
      app: whatsapp-mysql
  template:
    metadata:
      labels:
        app: whatsapp-mysql
    spec:
      containers:
      - name: mysql
        image: mysql:8.0
        ports:
        - containerPort: 3306
        env:
        - name: MYSQL_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: whatsapp-secrets
              key: MYSQL_ROOT_PASSWORD
        - name: MYSQL_DATABASE
          valueFrom:
            configMapKeyRef:
              name: whatsapp-config
              key: MYSQL_DATABASE
        - name: MYSQL_USER
          valueFrom:
            configMapKeyRef:
              name: whatsapp-config
              key: MYSQL_USER
        - name: MYSQL_PASSWORD
          valueFrom:
            secretKeyRef:
              name: whatsapp-secrets
              key: MYSQL_PASSWORD
        volumeMounts:
        - name: mysql-data
          mountPath: /var/lib/mysql
        - name: mysql-init
          mountPath: /docker-entrypoint-initdb.d
        livenessProbe:
          exec:
            command:
            - mysqladmin
            - ping
            - -h
            - localhost
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - mysqladmin
            - ping
            - -h
            - localhost
          initialDelaySeconds: 10
          periodSeconds: 5
      volumes:
      - name: mysql-init
        configMap:
          name: mysql-init-script
  volumeClaimTemplates:
  - metadata:
      name: mysql-data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: standard  # Cambiar según tu cluster
      resources:
        requests:
          storage: 10Gi
```

**Crear ConfigMap con script de inicialización:**

```bash
# Copiar schema.sql a un ConfigMap
kubectl create configmap mysql-init-script \
  --from-file=init.sql=database/schema.sql \
  -n whatsapp-masivo
```

**Aplicar:**
```bash
kubectl apply -f k8s/mysql.yaml
```

### 3.2 Redis Deployment

Crear archivo `k8s/redis.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: whatsapp-redis
  namespace: whatsapp-masivo
spec:
  selector:
    app: whatsapp-redis
  ports:
    - port: 6379
      targetPort: 6379
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: whatsapp-redis
  namespace: whatsapp-masivo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: whatsapp-redis
  template:
    metadata:
      labels:
        app: whatsapp-redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        command:
        - redis-server
        - --appendonly
        - "yes"
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: whatsapp-secrets
              key: REDIS_PASSWORD
        volumeMounts:
        - name: redis-data
          mountPath: /data
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: redis-data
        persistentVolumeClaim:
          claimName: redis-pvc
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
  namespace: whatsapp-masivo
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard  # Cambiar según tu cluster
  resources:
    requests:
      storage: 5Gi
```

**Aplicar:**
```bash
kubectl apply -f k8s/redis.yaml
```

---

## 📱 **Paso 4: Despliegue de la Aplicación**

### 4.1 Crear PersistentVolume para Sesiones (NFS)

**Si usas NFS**, crear archivo `k8s/pv-sessions.yaml`:

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
    - ReadWriteMany  # CRÍTICO: Permite múltiples pods leyendo/escribiendo
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: 192.168.1.100  # IP de tu servidor NFS
    path: /mnt/nfs/whatsapp-sessions
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: whatsapp-sessions-pvc
  namespace: whatsapp-masivo
spec:
  accessModes:
    - ReadWriteMany  # CRÍTICO para compartir sesiones
  storageClassName: ""
  resources:
    requests:
      storage: 50Gi
  volumeName: whatsapp-sessions-pv
```

**Aplicar:**
```bash
kubectl apply -f k8s/pv-sessions.yaml
```

### 4.2 Build y Push de Imagen Docker

```bash
# Construir imagen
docker build -t tu-usuario/whatsapp-masivo:latest .

# Si usas Docker Hub
docker login
docker push tu-usuario/whatsapp-masivo:latest

# Si usas registry privado (ej: Harbor, GitLab Registry)
docker tag tu-usuario/whatsapp-masivo:latest registry.tu-dominio.com/whatsapp-masivo:latest
docker push registry.tu-dominio.com/whatsapp-masivo:latest
```

### 4.3 Deployment de la Aplicación

Crear archivo `k8s/app.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: whatsapp-app
  namespace: whatsapp-masivo
spec:
  type: LoadBalancer  # O NodePort si no tienes LoadBalancer
  selector:
    app: whatsapp-app
  ports:
    - port: 3000
      targetPort: 3000
      protocol: TCP
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: whatsapp-app
  namespace: whatsapp-masivo
spec:
  replicas: 3  # Múltiples réplicas para alta disponibilidad
  selector:
    matchLabels:
      app: whatsapp-app
  template:
    metadata:
      labels:
        app: whatsapp-app
    spec:
      containers:
      - name: app
        image: tu-usuario/whatsapp-masivo:latest  # Cambiar por tu imagen
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
        env:
        # Variables de configuración
        - name: PORT
          valueFrom:
            configMapKeyRef:
              name: whatsapp-config
              key: PORT
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: whatsapp-config
              key: NODE_ENV
        # Base de datos
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: whatsapp-config
              key: DB_HOST
        - name: DB_PORT
          valueFrom:
            configMapKeyRef:
              name: whatsapp-config
              key: DB_PORT
        - name: DB_NAME
          valueFrom:
            configMapKeyRef:
              name: whatsapp-config
              key: DB_NAME
        - name: DB_USER
          valueFrom:
            configMapKeyRef:
              name: whatsapp-config
              key: MYSQL_USER
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: whatsapp-secrets
              key: MYSQL_PASSWORD
        # Redis
        - name: REDIS_HOST
          valueFrom:
            configMapKeyRef:
              name: whatsapp-config
              key: REDIS_HOST
        - name: REDIS_PORT
          valueFrom:
            configMapKeyRef:
              name: whatsapp-config
              key: REDIS_PORT
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: whatsapp-secrets
              key: REDIS_PASSWORD
        # JWT y Sesiones
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: whatsapp-secrets
              key: JWT_SECRET
        - name: SESSION_SECRET
          valueFrom:
            secretKeyRef:
              name: whatsapp-secrets
              key: SESSION_SECRET
        # Python Microservice
        - name: PYTHON_SERVICE_URL
          valueFrom:
            configMapKeyRef:
              name: whatsapp-config
              key: PYTHON_SERVICE_URL
        volumeMounts:
        # CRÍTICO: Montar volumen compartido para sesiones
        - name: sessions
          mountPath: /app/sessions
        - name: uploads
          mountPath: /app/uploads
        - name: downloads
          mountPath: /app/downloads
        - name: chats
          mountPath: /app/chats
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 40
          periodSeconds: 30
          timeoutSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 20
          periodSeconds: 10
          timeoutSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
      volumes:
      # Sesiones compartidas (ReadWriteMany)
      - name: sessions
        persistentVolumeClaim:
          claimName: whatsapp-sessions-pvc
      # Uploads, downloads y chats también compartidos
      - name: uploads
        persistentVolumeClaim:
          claimName: whatsapp-uploads-pvc
      - name: downloads
        persistentVolumeClaim:
          claimName: whatsapp-downloads-pvc
      - name: chats
        persistentVolumeClaim:
          claimName: whatsapp-chats-pvc
```

### 4.4 PVCs Adicionales (uploads, downloads, chats)

Crear archivo `k8s/pvc-adicionales.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: whatsapp-uploads-pv
  namespace: whatsapp-masivo
spec:
  capacity:
    storage: 20Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: 192.168.1.100  # IP de tu servidor NFS
    path: /mnt/nfs/whatsapp-uploads
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: whatsapp-uploads-pvc
  namespace: whatsapp-masivo
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: ""
  resources:
    requests:
      storage: 20Gi
  volumeName: whatsapp-uploads-pv
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: whatsapp-downloads-pv
  namespace: whatsapp-masivo
spec:
  capacity:
    storage: 20Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: 192.168.1.100
    path: /mnt/nfs/whatsapp-downloads
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: whatsapp-downloads-pvc
  namespace: whatsapp-masivo
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: ""
  resources:
    requests:
      storage: 20Gi
  volumeName: whatsapp-downloads-pv
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: whatsapp-chats-pv
  namespace: whatsapp-masivo
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: 192.168.1.100
    path: /mnt/nfs/whatsapp-chats
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: whatsapp-chats-pvc
  namespace: whatsapp-masivo
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: ""
  resources:
    requests:
      storage: 10Gi
  volumeName: whatsapp-chats-pv
```

### 4.5 Aplicar Todo

```bash
# Aplicar PVCs adicionales
kubectl apply -f k8s/pvc-adicionales.yaml

# Aplicar deployment de la app
kubectl apply -f k8s/app.yaml

# Verificar estado
kubectl get pods -n whatsapp-masivo
kubectl get services -n whatsapp-masivo
kubectl get pvc -n whatsapp-masivo
```

---

## 🌐 **Paso 5: Configuración de Acceso**

### 5.1 Obtener IP del Servicio

```bash
# Si usas LoadBalancer
kubectl get svc whatsapp-app -n whatsapp-masivo

# Si usas NodePort
kubectl get svc whatsapp-app -n whatsapp-masivo
# Luego acceder a: http://IP_NODO:PUERTO_NODEPORT
```

### 5.2 Configurar Ingress (Opcional, para dominio)

Crear archivo `k8s/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: whatsapp-ingress
  namespace: whatsapp-masivo
  annotations:
    nginx.ingress.kubernetes.io/websocket-services: "whatsapp-app"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
spec:
  rules:
  - host: whatsapp.tu-dominio.com  # Cambiar por tu dominio
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: whatsapp-app
            port:
              number: 3000
```

**Aplicar:**
```bash
kubectl apply -f k8s/ingress.yaml
```

---

## ✅ **Paso 6: Verificación y Pruebas**

### 6.1 Verificar Estado de Pods

```bash
# Ver todos los pods
kubectl get pods -n whatsapp-masivo

# Ver logs de la aplicación
kubectl logs -f deployment/whatsapp-app -n whatsapp-masivo

# Ver logs de un pod específico
kubectl logs -f whatsapp-app-xxxxx -n whatsapp-masivo
```

### 6.2 Verificar Sesiones Compartidas

```bash
# Ejecutar comando en un pod
kubectl exec -it whatsapp-app-xxxxx -n whatsapp-masivo -- ls -la /app/sessions

# Crear sesión desde PC 1 (via navegador)
# Verificar que aparece en otro pod
kubectl exec -it whatsapp-app-yyyyy -n whatsapp-masivo -- ls -la /app/sessions
```

### 6.3 Probar desde Múltiples PCs

1. **PC 1**: Acceder a `http://IP_SERVICIO:3000`
2. **Login** con admin/admin123
3. **Crear dispositivo** y escanear QR
4. **PC 2**: Acceder a `http://IP_SERVICIO:3000` (mismo servicio)
5. **Verificar** que aparece el mismo dispositivo conectado
6. **Enviar mensaje** desde PC 1
7. **Verificar** que aparece en PC 2

---

## 🔧 **Troubleshooting**

### Problema: Pods no inician

```bash
# Ver eventos
kubectl describe pod whatsapp-app-xxxxx -n whatsapp-masivo

# Ver logs
kubectl logs whatsapp-app-xxxxx -n whatsapp-masivo

# Verificar PVCs
kubectl get pvc -n whatsapp-masivo
kubectl describe pvc whatsapp-sessions-pvc -n whatsapp-masivo
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

### Problema: No puedo acceder desde fuera del cluster

```bash
# Verificar servicio
kubectl get svc whatsapp-app -n whatsapp-masivo

# Si es NodePort, ver puerto asignado
kubectl get svc whatsapp-app -n whatsapp-masivo -o jsonpath='{.spec.ports[0].nodePort}'

# Verificar firewall
# En nodos: sudo ufw status
```

### Problema: Base de datos no conecta

```bash
# Verificar que MySQL está corriendo
kubectl get pods -n whatsapp-masivo | grep mysql

# Ver logs de MySQL
kubectl logs whatsapp-mysql-0 -n whatsapp-masivo

# Probar conexión desde pod de la app
kubectl exec -it whatsapp-app-xxxxx -n whatsapp-masivo -- \
  sh -c "mysql -h whatsapp-mysql -u whatsapp_user -p"
```

---

## 📈 **Mantenimiento y Escalado**

### Escalar Aplicación

```bash
# Aumentar número de réplicas
kubectl scale deployment whatsapp-app --replicas=5 -n whatsapp-masivo

# Ver réplicas
kubectl get deployment whatsapp-app -n whatsapp-masivo
```

### Actualizar Aplicación

```bash
# 1. Construir nueva imagen
docker build -t tu-usuario/whatsapp-masivo:v2.0 .

# 2. Push a registry
docker push tu-usuario/whatsapp-masivo:v2.0

# 3. Actualizar deployment
kubectl set image deployment/whatsapp-app \
  app=tu-usuario/whatsapp-masivo:v2.0 \
  -n whatsapp-masivo

# 4. Ver rollout
kubectl rollout status deployment/whatsapp-app -n whatsapp-masivo

# 5. Si hay problemas, hacer rollback
kubectl rollout undo deployment/whatsapp-app -n whatsapp-masivo
```

### Backups

```bash
# Backup MySQL
kubectl exec whatsapp-mysql-0 -n whatsapp-masivo -- \
  mysqldump -u root -pwhatsapp_root_2025 whatsapp_masivo > backup_$(date +%Y%m%d).sql

# Backup de sesiones (desde servidor NFS)
sudo tar czf sessions_backup_$(date +%Y%m%d).tar.gz /mnt/nfs/whatsapp-sessions
```

### Limpiar Recursos

```bash
# Eliminar todo el namespace (CUIDADO: Borra todo)
kubectl delete namespace whatsapp-masivo

# Eliminar solo deployment
kubectl delete deployment whatsapp-app -n whatsapp-masivo
```

---

## 📝 **Resumen de Comandos Principales**

```bash
# Crear namespace
kubectl create namespace whatsapp-masivo

# Aplicar todos los recursos
kubectl apply -f k8s/

# Ver estado
kubectl get all -n whatsapp-masivo

# Ver logs
kubectl logs -f deployment/whatsapp-app -n whatsapp-masivo

# Escalar
kubectl scale deployment whatsapp-app --replicas=3 -n whatsapp-masivo

# Actualizar
kubectl set image deployment/whatsapp-app app=tu-usuario/whatsapp-masivo:v2.0 -n whatsapp-masivo

# Ver servicios
kubectl get svc -n whatsapp-masivo

# Acceder a pod
kubectl exec -it whatsapp-app-xxxxx -n whatsapp-masivo -- sh
```

---

## ✅ **Checklist de Despliegue**

- [ ] Kubernetes cluster configurado (mínimo 2 nodos)
- [ ] NFS Server configurado (o storage compartido)
- [ ] kubectl instalado y configurado
- [ ] Imagen Docker construida y subida a registry
- [ ] Secrets creados (con contraseñas seguras)
- [ ] ConfigMaps creados
- [ ] MySQL desplegado y funcionando
- [ ] Redis desplegado y funcionando
- [ ] PersistentVolumes creados (ReadWriteMany)
- [ ] Aplicación desplegada (múltiples réplicas)
- [ ] Servicios configurados (LoadBalancer o NodePort)
- [ ] Acceso probado desde múltiples PCs
- [ ] Sesiones compartidas verificadas
- [ ] Backups configurados

---

## 🎉 **¡Sistema Listo!**

Ahora tienes un sistema desplegado en Kubernetes con:
- ✅ **Múltiples réplicas** de la aplicación
- ✅ **Sesiones compartidas** entre todos los pods
- ✅ **Base de datos centralizada**
- ✅ **Alta disponibilidad**
- ✅ **Escalabilidad horizontal**
- ✅ **Acceso desde múltiples PCs**

**Próximos Pasos:**
1. Configurar dominio y HTTPS (Ingress + Certbot)
2. Configurar monitoreo (Prometheus + Grafana)
3. Configurar alertas
4. Documentar acceso para usuarios
5. Configurar backups automáticos

---

**📧 Soporte:** Ver documentación en `/docs`
**🔧 Actualizaciones:** `kubectl set image deployment/whatsapp-app app=imagen:version -n whatsapp-masivo`

