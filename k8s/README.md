# 🚀 Manifiestos Kubernetes - Sistema WhatsApp Masivo

Esta carpeta contiene todos los manifiestos de Kubernetes necesarios para desplegar el sistema en un cluster de Kubernetes.

## 📋 **Archivos**

- `namespace.yaml` - Namespace para la aplicación
- `secrets.yaml` - Secretos (contraseñas, JWT, etc.)
- `configmap.yaml` - Configuración de la aplicación
- `mysql.yaml` - MySQL StatefulSet y Service
- `redis.yaml` - Redis Deployment, Service y PVC
- `pv-sessions-nfs.yaml` - PersistentVolume para sesiones (NFS)
- `pvc-adicionales.yaml` - PersistentVolumes para uploads, downloads y chats
- `app.yaml` - Deployment principal de la aplicación
- `ingress.yaml` - Ingress para acceso con dominio (opcional)

## 🚀 **Despliegue Rápido**

### 1. Configurar Secretos

⚠️ **IMPORTANTE**: Editar `secrets.yaml` y cambiar todas las contraseñas.

```bash
# Editar secrets
nano k8s/secrets.yaml
```

### 2. Configurar NFS (si usas NFS)

⚠️ **IMPORTANTE**: Editar `pv-sessions-nfs.yaml` y `pvc-adicionales.yaml` con la IP de tu servidor NFS.

```bash
# Editar PVs
nano k8s/pv-sessions-nfs.yaml
nano k8s/pvc-adicionales.yaml
```

### 3. Configurar Imagen Docker

⚠️ **IMPORTANTE**: Editar `app.yaml` y cambiar `tu-usuario/whatsapp-masivo:latest` por tu imagen.

```bash
# Editar app.yaml
nano k8s/app.yaml
```

### 4. Crear Script de Inicialización MySQL

```bash
# Crear ConfigMap con schema.sql
kubectl create configmap mysql-init-script \
  --from-file=init.sql=../database/schema.sql \
  -n whatsapp-masivo
```

### 5. Aplicar Manifiestos en Orden

```bash
# 1. Crear namespace
kubectl apply -f k8s/namespace.yaml

# 2. Crear secrets y configmap
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml

# 3. Crear script de inicialización MySQL
kubectl create configmap mysql-init-script \
  --from-file=init.sql=../database/schema.sql \
  -n whatsapp-masivo

# 4. Desplegar MySQL
kubectl apply -f k8s/mysql.yaml

# 5. Desplegar Redis
kubectl apply -f k8s/redis.yaml

# 6. Esperar a que MySQL esté listo
kubectl wait --for=condition=ready pod -l app=whatsapp-mysql -n whatsapp-masivo --timeout=300s

# 7. Crear PersistentVolumes (si usas NFS)
kubectl apply -f k8s/pv-sessions-nfs.yaml
kubectl apply -f k8s/pvc-adicionales.yaml

# 8. Desplegar aplicación
kubectl apply -f k8s/app.yaml

# 9. (Opcional) Desplegar Ingress
kubectl apply -f k8s/ingress.yaml
```

### 6. Verificar Estado

```bash
# Ver todos los recursos
kubectl get all -n whatsapp-masivo

# Ver pods
kubectl get pods -n whatsapp-masivo

# Ver servicios
kubectl get svc -n whatsapp-masivo

# Ver PVCs
kubectl get pvc -n whatsapp-masivo

# Ver logs de la aplicación
kubectl logs -f deployment/whatsapp-app -n whatsapp-masivo
```

## 📖 **Documentación Completa**

Ver `docs/KUBERNETES_DEPLOYMENT.md` para documentación completa paso a paso.

## 🔧 **Comandos Útiles**

```bash
# Ver logs
kubectl logs -f deployment/whatsapp-app -n whatsapp-masivo

# Ejecutar comando en pod
kubectl exec -it whatsapp-app-xxxxx -n whatsapp-masivo -- sh

# Escalar aplicación
kubectl scale deployment whatsapp-app --replicas=5 -n whatsapp-masivo

# Actualizar imagen
kubectl set image deployment/whatsapp-app app=tu-usuario/whatsapp-masivo:v2.0 -n whatsapp-masivo

# Eliminar todo (CUIDADO)
kubectl delete namespace whatsapp-masivo
```

## ⚠️ **Notas Importantes**

1. **Storage Class**: Si usas un cluster en la nube, cambiar `storageClassName: standard` por el storage class de tu proveedor.

2. **NFS Server**: Si usas NFS, asegúrate de que todos los nodos del cluster puedan montar el servidor NFS.

3. **Imagen Docker**: Construir y subir la imagen antes de desplegar:
   ```bash
   docker build -t tu-usuario/whatsapp-masivo:latest .
   docker push tu-usuario/whatsapp-masivo:latest
   ```

4. **Secrets**: Cambiar todas las contraseñas antes de desplegar en producción.

5. **ReadWriteMany**: Los PVCs de sesiones DEBEN tener `accessModes: [ReadWriteMany]` para compartir entre múltiples pods.

## 🐛 **Troubleshooting**

Ver `docs/KUBERNETES_DEPLOYMENT.md` sección "Troubleshooting" para solucionar problemas comunes.

