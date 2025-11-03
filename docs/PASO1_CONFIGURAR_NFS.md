# 🔧 PASO 1: Configurar Servidor NFS
## Sesiones Compartidas para WhatsApp

---

## 🎯 **Objetivo**

Configurar un servidor NFS que compartirá las sesiones de WhatsApp entre múltiples PCs/nodos de Kubernetes.

---

## 💻 **¿Dónde Instalar NFS Server?**

Tienes **3 opciones** según tu entorno:

### **Opción A: Servidor Linux Dedicado** (Recomendado)
- Una PC/servidor Linux dedicada
- O una máquina virtual Linux
- O un servidor en la nube (AWS EC2, DigitalOcean, etc.)

### **Opción B: WSL2 en Windows**
- Usar Windows Subsystem for Linux 2
- Ejecutar NFS Server dentro de WSL2

### **Opción C: Uno de los Nodos de Kubernetes**
- Si ya tienes nodos Linux en tu cluster
- Instalar NFS Server directamente en uno de ellos

---

## 📋 **Instrucciones por Opción**

---

## **OPCIÓN A: Servidor Linux (Ubuntu/Debian) - RECOMENDADO**

### **Paso A.1: Verificar Sistema Operativo**

```bash
# Verificar que es Ubuntu/Debian
cat /etc/os-release

# Deberías ver algo como:
# PRETTY_NAME="Ubuntu 22.04 LTS"
# o
# PRETTY_NAME="Debian GNU/Linux 11 (bullseye)"
```

### **Paso A.2: Actualizar Sistema**

```bash
# Actualizar lista de paquetes
sudo apt update

# Actualizar sistema
sudo apt upgrade -y
```

### **Paso A.3: Instalar NFS Server**

```bash
# Instalar NFS Kernel Server
sudo apt install -y nfs-kernel-server

# Verificar que se instaló correctamente
sudo systemctl status nfs-kernel-server
```

Si ves "Active: active (exited)", está correctamente instalado.

### **Paso A.4: Crear Directorios Compartidos**

```bash
# Crear directorios para sesiones y datos compartidos
sudo mkdir -p /mnt/nfs/whatsapp-sessions
sudo mkdir -p /mnt/nfs/whatsapp-uploads
sudo mkdir -p /mnt/nfs/whatsapp-downloads
sudo mkdir -p /mnt/nfs/whatsapp-chats

# Verificar que se crearon
ls -la /mnt/nfs/
```

Deberías ver las 4 carpetas creadas.

### **Paso A.5: Configurar Permisos**

```bash
# Dar permisos amplios (necesario para que pods de Kubernetes puedan escribir)
sudo chown nobody:nogroup /mnt/nfs/whatsapp-sessions
sudo chown nobody:nogroup /mnt/nfs/whatsapp-uploads
sudo chown nobody:nogroup /mnt/nfs/whatsapp-downloads
sudo chown nobody:nogroup /mnt/nfs/whatsapp-chats

# Dar permisos de lectura/escritura a todos
sudo chmod 777 /mnt/nfs/whatsapp-sessions
sudo chmod 777 /mnt/nfs/whatsapp-uploads
sudo chmod 777 /mnt/nfs/whatsapp-downloads
sudo chmod 777 /mnt/nfs/whatsapp-chats

# Verificar permisos
ls -la /mnt/nfs/
```

### **Paso A.6: Configurar Exports de NFS**

```bash
# Editar archivo de exports
sudo nano /etc/exports
```

**Agregar estas líneas al final del archivo:**

```
/mnt/nfs/whatsapp-sessions *(rw,sync,no_subtree_check,no_root_squash)
/mnt/nfs/whatsapp-uploads *(rw,sync,no_subtree_check,no_root_squash)
/mnt/nfs/whatsapp-downloads *(rw,sync,no_subtree_check,no_root_squash)
/mnt/nfs/whatsapp-chats *(rw,sync,no_subtree_check,no_root_squash)
```

**Explicación:**
- `*` = permite acceso desde cualquier IP (puedes restringir a tu red local si prefieres)
- `rw` = lectura y escritura
- `sync` = escribir cambios sincrónicamente
- `no_subtree_check` = mejor rendimiento
- `no_root_squash` = permite que root de pods acceda

**Guardar y cerrar:**
- Presiona `Ctrl + X`
- Presiona `Y` para confirmar
- Presiona `Enter` para guardar

### **Paso A.7: Aplicar Configuración**

```bash
# Aplicar configuración de exports
sudo exportfs -ra

# Reiniciar servicio NFS
sudo systemctl restart nfs-kernel-server

# Habilitar inicio automático al reiniciar
sudo systemctl enable nfs-kernel-server

# Verificar que está corriendo
sudo systemctl status nfs-kernel-server
```

Deberías ver "Active: active (exited)" en verde.

### **Paso A.8: Configurar Firewall**

```bash
# Verificar si firewall está activo
sudo ufw status

# Si está activo, permitir NFS
sudo ufw allow from any to any port 111
sudo ufw allow from any to any port 2049
sudo ufw allow from any to any port 20048

# Si solo quieres permitir desde tu red local (más seguro):
# sudo ufw allow from 192.168.1.0/24 to any port 111
# sudo ufw allow from 192.168.1.0/24 to any port 2049
# sudo ufw allow from 192.168.1.0/24 to any port 20048

# Verificar reglas
sudo ufw status numbered
```

### **Paso A.9: Verificar Exports**

```bash
# Ver qué está exportado
sudo exportfs -v

# O usar showmount
showmount -e localhost
```

Deberías ver las 4 rutas exportadas.

### **Paso A.10: Obtener IP del Servidor NFS**

```bash
# Ver IP del servidor
hostname -I

# O más detallado
ip addr show | grep "inet " | grep -v 127.0.0.1
```

**📝 ANOTAR ESTA IP** (ejemplo: `192.168.1.100`)

La necesitarás más adelante para configurar los PersistentVolumes en Kubernetes.

### **Paso A.11: Probar NFS Localmente (Opcional pero Recomendado)**

```bash
# Crear punto de montaje temporal
sudo mkdir -p /mnt/test-nfs

# Montar NFS localmente
sudo mount -t nfs localhost:/mnt/nfs/whatsapp-sessions /mnt/test-nfs

# Verificar que funciona
ls -la /mnt/test-nfs

# Crear archivo de prueba
sudo touch /mnt/test-nfs/test.txt
ls /mnt/test-nfs/

# Desmontar
sudo umount /mnt/test-nfs

# Limpiar
sudo rmdir /mnt/test-nfs
```

Si puedes crear archivos, NFS está funcionando correctamente.

---

## **OPCIÓN B: WSL2 en Windows**

### **Paso B.1: Verificar WSL2 Instalado**

```powershell
# En PowerShell de Windows
wsl --list --verbose

# Si no tienes WSL2, instalar:
wsl --install
```

### **Paso B.2: Abrir WSL2**

```bash
# Abrir Ubuntu/Debian en WSL2
wsl
```

### **Paso B.3: Seguir Pasos de Opción A**

Seguir desde **Paso A.2** en adelante (actualizar, instalar NFS, crear directorios, etc.)

**⚠️ IMPORTANTE EN WSL2:**

```bash
# WSL2 necesita configuración adicional para NFS Server
# Editar /etc/default/nfs-kernel-server
sudo nano /etc/default/nfs-kernel-server

# Cambiar:
# RPCMOUNTDOPTS="--manage-gids"
# a:
RPCMOUNTDOPTS="--manage-gids --port 32767"

# Reiniciar
sudo systemctl restart nfs-kernel-server
```

**⚠️ Nota:** La IP de WSL2 cambia al reiniciar. Para obtener IP estable:

```bash
# Ver IP actual de WSL2
hostname -I
```

---

## **OPCIÓN C: CentOS/RHEL/Fedora**

Si usas CentOS, RHEL o Fedora:

```bash
# Instalar NFS
sudo yum install -y nfs-utils
# o en Fedora:
sudo dnf install -y nfs-utils

# Habilitar servicios
sudo systemctl enable nfs-server rpcbind
sudo systemctl start nfs-server rpcbind

# Crear directorios (mismo proceso)
sudo mkdir -p /mnt/nfs/{whatsapp-sessions,whatsapp-uploads,whatsapp-downloads,whatsapp-chats}
sudo chown nobody:nobody /mnt/nfs/whatsapp-*
sudo chmod 777 /mnt/nfs/whatsapp-*

# Configurar exports
sudo nano /etc/exports
# Agregar las mismas líneas que en Ubuntu/Debian

# Aplicar
sudo exportfs -ra
sudo systemctl restart nfs-server

# Firewall (si usas firewalld)
sudo firewall-cmd --permanent --add-service=nfs
sudo firewall-cmd --permanent --add-service=rpc-bind
sudo firewall-cmd --permanent --add-service=mountd
sudo firewall-cmd --reload
```

---

## ✅ **Verificación Final**

### **Checklist:**

- [ ] NFS Server instalado y corriendo
- [ ] Directorios creados: `/mnt/nfs/whatsapp-sessions`, etc.
- [ ] Permisos configurados (777)
- [ ] `/etc/exports` configurado con las 4 rutas
- [ ] `sudo exportfs -ra` ejecutado sin errores
- [ ] Servicio NFS corriendo (`sudo systemctl status nfs-kernel-server`)
- [ ] Firewall configurado (puertos 111, 2049, 20048)
- [ ] IP del servidor NFS anotada
- [ ] Prueba local exitosa (montaje y creación de archivo)

### **Comandos de Verificación Rápida:**

```bash
# Ver estado del servicio
sudo systemctl status nfs-kernel-server

# Ver exports activos
sudo exportfs -v

# Ver IP del servidor
hostname -I

# Ver permisos de directorios
ls -la /mnt/nfs/
```

---

## 🐛 **Troubleshooting**

### **Problema: NFS no inicia**

```bash
# Ver logs
sudo journalctl -u nfs-kernel-server -n 50

# Verificar que puertos están libres
sudo netstat -tulpn | grep -E "111|2049"
```

### **Problema: No puedo crear archivos en NFS**

```bash
# Verificar permisos
ls -la /mnt/nfs/whatsapp-sessions

# Si no tiene 777, corregir:
sudo chmod 777 /mnt/nfs/whatsapp-sessions

# Verificar ownership
sudo chown nobody:nogroup /mnt/nfs/whatsapp-sessions
```

### **Problema: Firewall bloquea NFS**

```bash
# Verificar reglas de firewall
sudo ufw status numbered

# Permitir NFS explícitamente
sudo ufw allow 111/tcp
sudo ufw allow 2049/tcp
sudo ufw allow 20048/tcp
sudo ufw allow 111/udp
sudo ufw allow 2049/udp
sudo ufw allow 20048/udp
```

### **Problema: No puedo ver exports**

```bash
# Verificar archivo exports
cat /etc/exports

# Aplicar de nuevo
sudo exportfs -ra

# Reiniciar servicio
sudo systemctl restart nfs-kernel-server
```

---

## 📝 **Resumen de lo que Necesitas Anotar**

Después de completar este paso, necesitas tener anotado:

1. **IP del Servidor NFS**: `__________` (ejemplo: 192.168.1.100)

Esta IP la usarás en el Paso 4 cuando edites los archivos de PersistentVolumes.

---

## 🎉 **¡Paso 1 Completado!**

Una vez que hayas verificado todos los puntos del checklist, tienes tu servidor NFS listo y funcionando.

**Próximo Paso:** Configurar Kubernetes (Paso 2)

---

**¿Necesitas ayuda con algún paso específico?** Indica qué opción estás usando (Linux dedicado, WSL2, o nodo de Kubernetes) y te ayudo con más detalles.

