# 🚀 Guía Rápida - Despliegue Kubernetes

## 📋 **Resumen de Pasos**

### **Paso 1: Preparar Servidor NFS (Sesiones Compartidas)**

```bash
# En servidor Linux (Ubuntu/Debian)
sudo apt update
sudo apt install -y nfs-kernel-server

# Crear directorios compartidos
sudo mkdir -p /mnt/nfs/{whatsapp-sessions,whatsapp-uploads,whatsapp-downloads,whatsapp-chats}
sudo chown nobody:nogroup /mnt/nfs/whatsapp-*
sudo chmod 777 /mnt/nfs/whatsapp-*

# Configurar NFS
echo "/mnt/nfs/whatsapp-sessions *(rw,sync,no_subtree_check,no_root_squash)" | sudo tee -a /etc/exports
echo "/mnt/nfs/whatsapp-uploads *(rw,sync,no_subtree_check,no_root_squash)" | sudo tee -a /etc/exports
echo "/mnt/nfs/whatsapp-downloads *(rw,sync,no_subtree_check,no_root_squash)" | sudo tee -a /etc/exports
echo "/mnt/nfs/whatsapp-chats *(rw,sync,no_subtree_check,no_root_squash)" | sudo tee -a /etc/exports

# Reiniciar NFS
sudo exportfs -ra
sudo systemctl restart nfs-kernel-server
sudo systemctl enable nfs-kernel-server

# Obtener IP del servidor
hostname -I
```

**Anotar la IP del servidor NFS** (ejemplo: `192.168.1.100`)

---

### **Paso 2: Configurar Cluster Kubernetes**

#### **Opción A: Docker Desktop (Windows/Mac)**
1. Instalar Docker Desktop
2. Settings → Kubernetes → Enable Kubernetes
3. Esperar a que esté listo

#### **Opción B: Minikube**
```bash
minikube start --nodes=2 --driver=virtualbox
```

#### **Opción C: K3s (Múltiples PCs)**
```bash
# PC Principal (servidor)
curl -sfL https://get.k3s.io | sh -

# PCs Adicionales (workers)
curl -sfL https://get.k3s.io | K3S_URL=https://IP_SERVIDOR:6443 K3S_TOKEN=TOKEN sh -
```

---

### **Paso 3: Configurar Manifiestos**

#### 3.1 Editar Secrets (`k8s/secrets.yaml`)

```bash
nano k8s/secrets.yaml
```

⚠️ **Cambiar todas las contraseñas**:
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD`
- `JWT_SECRET` (mínimo 32 caracteres)
- `SESSION_SECRET` (mínimo 32 caracteres)

#### 3.2 Editar PersistentVolumes (NFS)

Editar `k8s/pv-sessions-nfs.yaml` y `k8s/pvc-adicionales.yaml`:

```yaml
nfs:
  server: 192.168.1.100  # ⚠️ CAMBIAR: IP de tu servidor NFS
  path: /mnt/nfs/whatsapp-sessions
```

#### 3.3 Editar Imagen Docker (`k8s/app.yaml`)

```yaml
image: tu-usuario/whatsapp-masivo:latest  # ⚠️ CAMBIAR: Tu imagen Docker
```

---

### **Paso 4: Construir y Subir Imagen Docker**

```bash
# Construir imagen
docker build -t tu-usuario/whatsapp-masivo:latest .

# Subir a Docker Hub (o registry privado)
docker login
docker push tu-usuario/whatsapp-masivo:latest
```

---

### **Paso 5: Desplegar**

#### **Linux/Mac:**
```bash
# Dar permisos de ejecución
chmod +x k8s/deploy.sh

# Ejecutar script
./k8s/deploy.sh
```

#### **Windows:**
```cmd
k8s\deploy.bat
```

#### **Manual:**
```bash
# Ver instrucciones completas en:
# k8s/README.md
```

---

### **Paso 6: Verificar y Acceder**

```bash
# Ver estado
kubectl get all -n whatsapp-masivo

# Ver logs
kubectl logs -f deployment/whatsapp-app -n whatsapp-masivo

# Obtener URL de acceso
kubectl get svc whatsapp-app -n whatsapp-masivo

# Si es LoadBalancer, esperar a que tenga IP externa
# Si es NodePort, acceder a: http://IP_NODO:PUERTO_NODEPORT
# Si no, usar port-forward:
kubectl port-forward svc/whatsapp-app 3000:3000 -n whatsapp-masivo
# Luego acceder a: http://localhost:3000
```

---

### **Paso 7: Verificar Sesiones Compartidas**

1. **PC 1**: Acceder a `http://IP_SERVICIO:3000`
2. **Login**: admin / admin123
3. **Crear dispositivo** y escanear QR
4. **PC 2**: Acceder a `http://IP_SERVICIO:3000`
5. **Verificar** que aparece el mismo dispositivo conectado
6. **Enviar mensaje** desde PC 1
7. **Verificar** que aparece en PC 2

---

## 🔧 **Comandos Útiles**

```bash
# Ver pods
kubectl get pods -n whatsapp-masivo

# Ver servicios
kubectl get svc -n whatsapp-masivo

# Ver PVCs
kubectl get pvc -n whatsapp-masivo

# Escalar aplicación
kubectl scale deployment/whatsapp-app --replicas=5 -n whatsapp-masivo

# Ver logs
kubectl logs -f deployment/whatsapp-app -n whatsapp-masivo

# Actualizar imagen
kubectl set image deployment/whatsapp-app app=tu-usuario/whatsapp-masivo:v2.0 -n whatsapp-masivo

# Eliminar todo (CUIDADO)
kubectl delete namespace whatsapp-masivo
```

---

## ⚠️ **Checklist Pre-Despliegue**

- [ ] Kubernetes cluster configurado (mínimo 2 nodos)
- [ ] NFS Server configurado y funcionando
- [ ] kubectl instalado y configurado
- [ ] Imagen Docker construida y subida
- [ ] Secrets editados (contraseñas cambiadas)
- [ ] PVs editados (IP NFS configurada)
- [ ] app.yaml editado (imagen configurada)

---

## 🐛 **Problemas Comunes**

### **Error: PVC en estado Pending**

```bash
# Verificar PVC
kubectl describe pvc whatsapp-sessions-pvc -n whatsapp-masivo

# Verificar PV
kubectl get pv whatsapp-sessions-pv

# Verificar acceso NFS desde nodos
# En cada nodo del cluster:
sudo apt install -y nfs-common
sudo mount -t nfs IP_SERVIDOR_NFS:/mnt/nfs/whatsapp-sessions /mnt/test
```

### **Error: Pods no inician**

```bash
# Ver eventos
kubectl describe pod whatsapp-app-xxxxx -n whatsapp-masivo

# Ver logs
kubectl logs whatsapp-app-xxxxx -n whatsapp-masivo

# Verificar recursos
kubectl top pods -n whatsapp-masivo
```

### **Error: Sesiones no se comparten**

```bash
# Verificar que PVC tiene ReadWriteMany
kubectl get pvc whatsapp-sessions-pvc -n whatsapp-masivo -o yaml | grep accessModes

# Verificar montaje en pods
kubectl exec whatsapp-app-xxxxx -n whatsapp-masivo -- ls -la /app/sessions

# Verificar permisos NFS
kubectl exec whatsapp-app-xxxxx -n whatsapp-masivo -- df -h | grep sessions
```

---

## 📖 **Documentación Completa**

Para documentación detallada paso a paso, ver:
- `docs/KUBERNETES_DEPLOYMENT.md` - Guía completa
- `k8s/README.md` - Documentación de manifiestos

---

## ✅ **¡Listo!**

Ahora tienes tu sistema desplegado en Kubernetes con:
- ✅ Múltiples réplicas
- ✅ Sesiones compartidas entre pods
- ✅ Base de datos centralizada
- ✅ Alta disponibilidad
- ✅ Escalabilidad horizontal

**Acceso desde múltiples PCs a la misma sesión de WhatsApp** ✅

