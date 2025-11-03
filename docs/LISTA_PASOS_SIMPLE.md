# ✅ Lista Simple de Pasos - Despliegue Multi-PC

> **Repositorio:** https://github.com/CamThreath991999/whatsappApp

---

## 🚀 **PASOS COMPLETOS**

### **1. CONFIGURAR SERVIDOR NFS**

```bash
# En servidor Linux (Ubuntu/Debian)
sudo apt update
sudo apt install -y nfs-kernel-server

# Crear directorios compartidos
sudo mkdir -p /mnt/nfs/{whatsapp-sessions,whatsapp-uploads,whatsapp-downloads,whatsapp-chats}
sudo chown nobody:nogroup /mnt/nfs/whatsapp-*
sudo chmod 777 /mnt/nfs/whatsapp-*

# Configurar NFS
sudo nano /etc/exports
# Agregar estas líneas:
/mnt/nfs/whatsapp-sessions *(rw,sync,no_subtree_check,no_root_squash)
/mnt/nfs/whatsapp-uploads *(rw,sync,no_subtree_check,no_root_squash)
/mnt/nfs/whatsapp-downloads *(rw,sync,no_subtree_check,no_root_squash)
/mnt/nfs/whatsapp-chats *(rw,sync,no_subtree_check,no_root_squash)

# Aplicar configuración
sudo exportfs -ra
sudo systemctl restart nfs-kernel-server
sudo systemctl enable nfs-kernel-server

# Obtener IP del servidor NFS
hostname -I
# 📝 ANOTAR ESTA IP (ejemplo: 192.168.1.100)
```

### **2. CONFIGURAR KUBERNETES**

**Opción A: Docker Desktop (Windows/Mac)**
- Instalar Docker Desktop
- Settings → Kubernetes → Enable Kubernetes
- Esperar a que esté "Running"

**Opción B: Minikube**
```bash
minikube start --nodes=2 --driver=virtualbox
```

**Opción C: K3s (Múltiples PCs)**
```bash
# PC Principal
curl -sfL https://get.k3s.io | sh -

# PCs Adicionales
curl -sfL https://get.k3s.io | K3S_URL=https://IP_MASTER:6443 K3S_TOKEN=TOKEN sh -
```

**Verificar:**
```bash
kubectl get nodes
```

### **3. CLONAR REPOSITORIO**

```bash
git clone https://github.com/CamThreath991999/whatsappApp.git
cd whatsappApp
```

### **4. EDITAR CONFIGURACIÓN**

**4.1 Editar Secrets:**
```bash
nano k8s/secrets.yaml
```
- ⚠️ Cambiar `MYSQL_ROOT_PASSWORD`
- ⚠️ Cambiar `MYSQL_PASSWORD`
- ⚠️ Cambiar `JWT_SECRET` (mínimo 32 caracteres)
- ⚠️ Cambiar `SESSION_SECRET` (mínimo 32 caracteres)

**4.2 Editar PersistentVolumes (IP NFS):**
```bash
nano k8s/pv-sessions-nfs.yaml
nano k8s/pvc-adicionales.yaml
```
- ⚠️ Cambiar `server: 192.168.1.100` por la IP de tu servidor NFS

**4.3 Editar Imagen Docker:**
```bash
nano k8s/app.yaml
```
- ⚠️ Cambiar `image: tu-usuario/whatsapp-masivo:latest` por tu imagen

### **5. CONSTRUIR Y SUBIR IMAGEN DOCKER**

```bash
# Construir imagen
docker build -t tu-usuario/whatsapp-masivo:latest .

# Subir a Docker Hub
docker login
docker push tu-usuario/whatsapp-masivo:latest

# O subir a GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u CamThreath991999 --password-stdin
docker tag tu-usuario/whatsapp-masivo:latest ghcr.io/camthreath991999/whatsappapp:latest
docker push ghcr.io/camthreath991999/whatsappapp:latest
```

### **6. DESPLEGAR EN KUBERNETES**

```bash
# 1. Crear namespace
kubectl apply -f k8s/namespace.yaml

# 2. Aplicar secrets y configmap
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml

# 3. Crear script de inicialización MySQL
kubectl create configmap mysql-init-script \
  --from-file=init.sql=database/schema.sql \
  -n whatsapp-masivo

# 4. Desplegar MySQL
kubectl apply -f k8s/mysql.yaml

# 5. Esperar a que MySQL esté listo
kubectl wait --for=condition=ready pod -l app=whatsapp-mysql -n whatsapp-masivo --timeout=300s

# 6. Desplegar Redis
kubectl apply -f k8s/redis.yaml

# 7. Crear PersistentVolumes
kubectl apply -f k8s/pv-sessions-nfs.yaml
kubectl apply -f k8s/pvc-adicionales.yaml

# 8. Desplegar aplicación
kubectl apply -f k8s/app.yaml

# 9. (Opcional) Desplegar Ingress
kubectl apply -f k8s/ingress.yaml
```

### **7. VERIFICAR DESPLIEGUE**

```bash
# Ver estado
kubectl get all -n whatsapp-masivo

# Ver logs
kubectl logs -f deployment/whatsapp-app -n whatsapp-masivo

# Obtener URL de acceso
kubectl get svc whatsapp-app -n whatsapp-masivo
```

### **8. CONFIGURAR SESIÓN DE WHATSAPP (PC 1)**

1. Abrir navegador: `http://IP_SERVICIO:PUERTO`
2. Login: `admin` / `admin123`
3. Ir a **Dispositivos** → **+ Nuevo Dispositivo**
4. Nombre: `Dispositivo Principal`
5. Clic en **Conectar**
6. Escanear QR con WhatsApp
7. Esperar "Conectado"

### **9. VERIFICAR DESDE OTRA PC (PC 2)**

1. Abrir navegador: `http://IP_SERVICIO:PUERTO` (misma URL)
2. Login: `admin` / `admin123`
3. Ir a **Dispositivos**
4. ✅ Verificar que aparece "Dispositivo Principal" conectado
5. Ir a **Envío Manual**
6. Seleccionar "Dispositivo Principal"
7. Enviar mensaje de prueba
8. ✅ Verificar que se envía desde la misma sesión

### **10. VERIFICAR SESIONES COMPARTIDAS**

```bash
# Ver sesiones desde un pod
kubectl exec -it whatsapp-app-xxxxx -n whatsapp-masivo -- ls -la /app/sessions

# Ver sesiones desde otro pod (deberían ser las mismas)
kubectl exec -it whatsapp-app-yyyyy -n whatsapp-masivo -- ls -la /app/sessions
```

---

## ✅ **CHECKLIST FINAL**

- [ ] Servidor NFS configurado
- [ ] IP del servidor NFS anotada
- [ ] Kubernetes cluster funcionando
- [ ] Repositorio clonado
- [ ] Secrets editados (contraseñas cambiadas)
- [ ] PersistentVolumes configurados (IP NFS correcta)
- [ ] Imagen Docker construida y subida
- [ ] app.yaml editado (imagen correcta)
- [ ] Todos los recursos desplegados
- [ ] Pods corriendo
- [ ] URL de acceso obtenida
- [ ] Sesión de WhatsApp creada desde PC 1
- [ ] Sesión visible desde PC 2
- [ ] Mensaje enviado desde PC 2 usando la misma sesión
- [ ] ✅ **TODO FUNCIONANDO**

---

## 🔧 **COMANDOS ÚTILES**

```bash
# Ver estado
kubectl get all -n whatsapp-masivo

# Ver logs
kubectl logs -f deployment/whatsapp-app -n whatsapp-masivo

# Escalar
kubectl scale deployment/whatsapp-app --replicas=5 -n whatsapp-masivo

# Actualizar
kubectl set image deployment/whatsapp-app app=imagen:nueva -n whatsapp-masivo

# Reiniciar
kubectl rollout restart deployment/whatsapp-app -n whatsapp-masivo

# Eliminar todo
kubectl delete namespace whatsapp-masivo
```

---

## 📖 **DOCUMENTACIÓN COMPLETA**

Para más detalles, ver:
- **Guía Completa**: `docs/PASOS_COMPLETOS_DESPLIEGUE.md`
- **Kubernetes Detallado**: `docs/KUBERNETES_DEPLOYMENT.md`
- **Guía Rápida**: `docs/GUIA_RAPIDA_KUBERNETES.md`

---

**🎯 Repositorio GitHub:** https://github.com/CamThreath991999/whatsappApp

