# 🚀 Guía de Despliegue Multi-PC

Esta guía te ayudará a desplegar el sistema para que múltiples PCs accedan a las **mismas sesiones de WhatsApp** y compartan la misma base de datos.

## 📋 Requisitos Previos

- **Servidor central**: Una PC que actuará como servidor (Windows, Linux o Mac)
- **PCs cliente**: Múltiples PCs que se conectarán al servidor (cualquier sistema con navegador)
- **Docker y Docker Compose** instalados en el servidor
- **Red local**: Todas las PCs deben estar en la misma red

---

## 🎯 Opción Recomendada: Servidor Central con Acceso Remoto

### Paso 1: Configurar el Servidor Central

1. **En tu PC servidor**, clona/descarga el proyecto:
```bash
cd C:\Users\casa\Documents\proyecto3\expressDb
```

2. **Crear archivo `.env`** (si no existe):
```bash
# .env
MYSQL_ROOT_PASSWORD=tu_password_seguro
MYSQL_DATABASE=whatsapp_masivo
MYSQL_USER=whatsapp_user
MYSQL_PASSWORD=tu_password_seguro
JWT_SECRET=tu_jwt_secret_muy_seguro
SESSION_SECRET=tu_session_secret_muy_seguro
```

3. **Modificar `docker-compose.yml`** para usar montajes bind (carpetas locales compartidas):

```yaml
services:
  app:
    volumes:
      # Montajes bind para compartir entre PCs
      - ./sessions:/app/sessions
      - ./uploads:/app/uploads
      - ./downloads:/app/downloads
      - ./chats:/app/chats
```

**IMPORTANTE**: Usar montajes bind (`./sessions`) en lugar de volúmenes nombrados permite acceso directo desde el sistema de archivos.

4. **Levantar los servicios**:
```bash
docker-compose up -d
```

5. **Verificar que todo funciona**:
```bash
docker-compose ps
docker-compose logs -f app
```

Deberías ver:
- ✅ `Socket.IO configurado`
- ✅ `Conectado a MySQL`
- ✅ `Conectado a Redis`

6. **Obtener la IP del servidor**:
```bash
# Windows
ipconfig

# Linux/Mac
ifconfig
# o
hostname -I
```

Anota la IP (ejemplo: `192.168.1.100`)

---

### Paso 2: Acceso desde PCs Cliente

**Desde cualquier PC en la misma red**:

1. Abre el navegador (Chrome, Firefox, Edge)
2. Ve a: `http://IP_DEL_SERVIDOR:3000`
   - Ejemplo: `http://192.168.1.100:3000`
3. Inicia sesión con tus credenciales
4. **¡Listo!** Verás las mismas sesiones de WhatsApp, campañas y chats

---

## 🔧 Configuración Avanzada: Múltiples Servidores

Si quieres ejecutar el sistema en **múltiples servidores** compartiendo las mismas sesiones:

### Opción A: Almacenamiento Compartido (NFS/SMB)

1. **Configurar un servidor de archivos** con:
   - Carpeta `sessions/` compartida (NFS o SMB)
   - Base de datos MySQL accesible remotamente
   - Redis accesible remotamente

2. **Modificar `docker-compose.yml`** en cada servidor:
```yaml
services:
  app:
    volumes:
      # Montar carpeta compartida de red
      - /mnt/nas/sessions:/app/sessions
      - /mnt/nas/uploads:/app/uploads
  mysql:
    # Usar MySQL remoto o quitar este servicio
  redis:
    # Usar Redis remoto o quitar este servicio
```

3. **Configurar acceso remoto a MySQL y Redis**:
   - MySQL: Crear usuario con acceso remoto
   - Redis: Exponer puerto y configurar firewall

---

## 🌐 Acceso desde Internet (Opcional)

Para acceder desde cualquier lugar (fuera de tu red local):

### Usar un túnel ngrok o similar:

1. **Instalar ngrok**:
```bash
# Descargar de https://ngrok.com/
ngrok http 3000
```

2. **Usar la URL que proporciona ngrok** (ejemplo: `https://abc123.ngrok.io`)

### O configurar un reverse proxy (Nginx):

1. Instalar Nginx en el servidor
2. Configurar proxy inverso hacia `http://localhost:3000`
3. Configurar certificado SSL (Let's Encrypt)

---

## ✅ Verificación Post-Despliegue

1. **Desde PC 1**: Crear una sesión de WhatsApp y escanear QR
2. **Desde PC 2**: Abrir `http://IP_SERVIDOR:3000` y verificar que aparece la misma sesión
3. **Enviar un mensaje desde PC 1**
4. **Ver el mensaje desde PC 2** sin recargar

---

## 🔒 Seguridad Recomendada

1. **Cambiar contraseñas por defecto** en `.env`
2. **Usar HTTPS** en producción (certificado SSL)
3. **Firewall**: Permitir solo puertos necesarios (3000, 3306, 6379)
4. **Autenticación fuerte**: Usuarios con contraseñas complejas

---

## 🐛 Solución de Problemas

### Error: "No puedo acceder desde otra PC"
- Verificar que el firewall permite conexiones al puerto 3000
- Verificar que ambas PCs están en la misma red
- Probar `ping IP_SERVIDOR` desde la PC cliente

### Error: "Las sesiones no se comparten"
- Verificar que `docker-compose.yml` usa montajes bind (`./sessions`)
- Verificar permisos de carpeta `sessions/`
- Reiniciar contenedores: `docker-compose restart app`

### Error: "Base de datos no accesible"
- Verificar que MySQL está expuesto en puerto 3306
- Verificar credenciales en `.env`
- Ver logs: `docker-compose logs mysql`

---

## 📞 Soporte

Si tienes problemas:
1. Revisar logs: `docker-compose logs -f`
2. Verificar estado: `docker-compose ps`
3. Reiniciar servicios: `docker-compose restart`

---

## 🎉 ¡Listo!

Ahora puedes:
- ✅ Acceder desde múltiples PCs a las mismas sesiones
- ✅ Ver las mismas campañas y chats
- ✅ Enviar mensajes desde cualquier PC
- ✅ Todos los usuarios ven los mismos datos

