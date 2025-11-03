# 🚀 Guía Paso a Paso - Despliegue Multi-PC en Windows

Esta guía te ayudará a desplegar el sistema en tu servidor Windows para que **múltiples PCs de la misma red puedan acceder a las mismas sesiones de WhatsApp**.

---

## 📋 **PASO 1: Verificar Requisitos en el Servidor Windows**

Antes de comenzar, verifica que tienes todo instalado.

### **1.1. Verificar que tienes Docker Desktop instalado**

1. Presiona `Windows + R`
2. Escribe: `powershell` y presiona Enter
3. Ejecuta este comando:

```powershell
docker --version
```

**Si ves un error** que dice "comando no reconocido", necesitas instalar Docker Desktop:
- Descarga desde: https://www.docker.com/products/docker-desktop/
- Instala y reinicia tu PC
- Ejecuta Docker Desktop (debe aparecer el ícono en la bandeja del sistema)

### **1.2. Verificar Docker Compose**

Ejecuta en PowerShell:

```powershell
docker-compose --version
```

**Si no funciona**, Docker Desktop ya incluye Docker Compose, solo necesitas reiniciar.

### **1.3. Verificar que tienes el proyecto**

En PowerShell, navega a tu proyecto:

```powershell
cd C:\Users\casa\Documents\proyecto3\expressDb
```

Verifica que existen estos archivos:
- `docker-compose.yml`
- `Dockerfile`
- `package.json`

---

## 📋 **PASO 2: Crear el Archivo de Configuración (.env)**

Este archivo contiene las contraseñas y configuración del sistema.

### **2.1. Crear el archivo .env**

1. En PowerShell, dentro de la carpeta del proyecto, ejecuta:

```powershell
New-Item -Path .env -ItemType File -Force
```

2. Abre el archivo `.env` con el Bloc de notas:

```powershell
notepad .env
```

### **2.2. Pegar esta configuración**

Copia y pega esto en el archivo `.env`:

```env
# ===========================================
# CONFIGURACIÓN DEL SISTEMA
# ===========================================
# IMPORTANTE: Cambia estas contraseñas por otras más seguras

# Base de datos MySQL
MYSQL_ROOT_PASSWORD=whatsapp_root_2025_seguro
MYSQL_DATABASE=whatsapp_masivo
MYSQL_USER=whatsapp_user
MYSQL_PASSWORD=whatsapp_pass_2025_seguro

# Redis (opcional, déjalo vacío si no usas contraseña)
REDIS_PASSWORD=

# Seguridad - Cambia estos valores por otros aleatorios
JWT_SECRET=cambia_este_secret_por_uno_aleatorio_y_largo_2025
SESSION_SECRET=cambia_este_session_secret_por_uno_aleatorio_2025

# Configuración de la aplicación
NODE_ENV=production
PORT=3000
```

3. **IMPORTANTE**: Cambia las contraseñas por otras más seguras. Guarda y cierra el archivo.

---

## 📋 **PASO 3: Crear las Carpetas Necesarias**

El sistema necesita estas carpetas para almacenar las sesiones de WhatsApp.

### **3.1. Crear las carpetas**

En PowerShell, ejecuta estos comandos uno por uno:

```powershell
New-Item -Path .\sessions -ItemType Directory -Force
New-Item -Path .\sessions_backup -ItemType Directory -Force
New-Item -Path .\uploads -ItemType Directory -Force
New-Item -Path .\downloads -ItemType Directory -Force
New-Item -Path .\chats -ItemType Directory -Force
```

### **3.2. Verificar que se crearon**

```powershell
dir sessions, sessions_backup, uploads, downloads, chats
```

Deberías ver las 5 carpetas listadas.

---

## 📋 **PASO 4: Configurar el Firewall de Windows**

Necesitas permitir que otras PCs accedan al puerto 3000.

### **4.1. Abrir el Firewall de Windows**

1. Presiona `Windows + R`
2. Escribe: `wf.msc` y presiona Enter
3. Se abrirá el "Firewall de Windows con seguridad avanzada"

### **4.2. Crear regla de entrada**

1. En el panel izquierdo, haz clic en **"Reglas de entrada"** (Inbound Rules)
2. En el panel derecho, haz clic en **"Nueva regla..."** (New Rule...)
3. Selecciona **"Puerto"** y haz clic en **Siguiente**
4. Selecciona **"TCP"**
5. Selecciona **"Puertos locales específicos"** y escribe: `3000`
6. Haz clic en **Siguiente**
7. Selecciona **"Permitir la conexión"**
8. Haz clic en **Siguiente** tres veces
9. En "Nombre", escribe: `WhatsApp Sistema - Puerto 3000`
10. Haz clic en **Finalizar**

### **4.3. (Opcional) Permitir también MySQL y Redis**

Si quieres que otras PCs puedan acceder directamente a MySQL o Redis (normalmente no es necesario), repite el paso 4.2 pero con los puertos:
- MySQL: `3306`
- Redis: `6379`

**Nota**: Solo necesitas esto si otras aplicaciones fuera de Docker necesitan acceder directamente a MySQL/Redis. Para el uso normal, NO es necesario.

---

## 📋 **PASO 5: Obtener la IP de tu Servidor**

Necesitas saber la dirección IP de tu servidor para que otras PCs se conecten.

### **5.1. Obtener la IP**

En PowerShell, ejecuta:

```powershell
ipconfig
```

Busca la sección **"Adaptador de Ethernet"** o **"Adaptador de LAN inalámbrica"** y anota el valor de **"IPv4"**.

**Ejemplo**: `192.168.1.100`

**⚠️ IMPORTANTE**: Anota esta IP, la necesitarás en el paso 7 para acceder desde otras PCs.

---

## 📋 **PASO 6: Levantar el Sistema con Docker**

Ahora vamos a iniciar todos los servicios.

### **6.1. Construir las imágenes de Docker**

En PowerShell, dentro de la carpeta del proyecto, ejecuta:

```powershell
docker-compose build
```

**⏱️ Esto puede tardar varios minutos** la primera vez (descarga dependencias). Espera a que termine.

### **6.2. Iniciar los servicios**

```powershell
docker-compose up -d
```

**¿Qué significa `-d`?** Ejecuta en segundo plano (detached mode), para que puedas seguir usando tu terminal.

### **6.3. Verificar que todo está funcionando**

Espera 30 segundos y luego ejecuta:

```powershell
docker-compose ps
```

Deberías ver algo como:

```
NAME                STATUS          PORTS
whatsapp_app        Up (healthy)    0.0.0.0:3000->3000/tcp
whatsapp_mysql      Up (healthy)    0.0.0.0:3306->3306/tcp
whatsapp_redis      Up (healthy)    0.0.0.0:6379->6379/tcp
```

Si ves **"(healthy)"** en los tres contenedores, ¡todo está bien!

### **6.4. Ver los logs (opcional)**

Para ver qué está pasando en tiempo real:

```powershell
docker-compose logs -f app
```

Presiona `Ctrl + C` para salir cuando quieras.

---

## 📋 **PASO 7: Probar el Acceso desde el Servidor**

Antes de probar desde otras PCs, verifica que funciona localmente.

### **7.1. Abrir el navegador en el servidor**

1. Abre tu navegador (Chrome, Edge, Firefox)
2. Ve a: `http://localhost:3000`
3. Deberías ver la pantalla de login del sistema

### **7.2. Crear el usuario administrador**

Si es la primera vez que usas el sistema, necesitas crear el usuario admin.

En PowerShell, ejecuta:

```powershell
docker exec -it whatsapp_app node scripts/crear_admin.js
```

Esto creará automáticamente un usuario admin con:
- **Usuario**: `admin`
- **Contraseña**: `admin123`

**⚠️ IMPORTANTE**: Cambia esta contraseña después del primer login por seguridad.

**Nota**: Si el comando da error porque el contenedor aún no está listo, espera 1 minuto más y vuelve a intentar.

---

## 📋 **PASO 8: Acceder desde Otras PCs de la Red**

Ahora que el servidor está funcionando, otras PCs pueden acceder.

### **8.1. En otra PC (debe estar en la misma red)**

1. Abre un navegador (Chrome, Edge, Firefox, etc.)
2. Ve a: `http://IP_DEL_SERVIDOR:3000`
   - Reemplaza `IP_DEL_SERVIDOR` con la IP que anotaste en el Paso 5
   - **Ejemplo**: `http://192.168.1.100:3000`

### **8.2. Si no puedes acceder**

**Problema común**: El firewall de la otra PC está bloqueando.

**Solución**:
- En la otra PC, abre Windows Defender Firewall
- Temporalmente, puedes desactivar el firewall PRIVADO para probar
- **O** mejor: Crea la misma regla de entrada (Paso 4) pero en la PC cliente

**Otra verificación**:
- Desde la otra PC, prueba hacer ping al servidor:
  - Abre PowerShell en la otra PC
  - Ejecuta: `ping IP_DEL_SERVIDOR` (ejemplo: `ping 192.168.1.100`)
  - Si funciona, la red está bien

---

## 📋 **PASO 9: Probar Compartir Sesión de WhatsApp**

Ahora vamos a probar que múltiples PCs usen la misma sesión de WhatsApp.

### **9.1. Desde la primera PC (servidor o cualquier PC)**

1. Accede a: `http://IP_DEL_SERVIDOR:3000`
2. Inicia sesión con tu usuario admin
3. Ve a la sección **"Dispositivos"** o **"WhatsApp"**
4. Crea un nuevo dispositivo/dispositivo de WhatsApp
5. Escanea el código QR con tu teléfono físico
6. Espera a que se conecte

### **9.2. Desde la segunda PC**

1. Accede a: `http://IP_DEL_SERVIDOR:3000` desde otra PC
2. Inicia sesión (puede ser el mismo usuario o diferente)
3. Ve a **"Dispositivos"**
4. **Deberías ver el mismo dispositivo** que acabas de conectar
5. Puedes enviar y recibir mensajes desde esta segunda PC

### **9.3. Verificar que funciona**

- Desde la PC 1: Envía un mensaje de prueba
- Desde la PC 2: Deberías ver el mensaje aparecer sin recargar
- Desde el teléfono físico: Deberías recibir y poder responder

---

## 📋 **PASO 10: Configuración Avanzada (Opcional)**

### **10.1. Hacer que el sistema inicie automáticamente**

Si quieres que el sistema se inicie automáticamente al encender el servidor:

1. Crea un archivo `iniciar_sistema.bat` en la carpeta del proyecto:

```batch
@echo off
cd /d C:\Users\casa\Documents\proyecto3\expressDb
docker-compose up -d
```

2. Presiona `Windows + R`, escribe: `shell:startup` y presiona Enter
3. Copia el archivo `iniciar_sistema.bat` a esa carpeta

Ahora el sistema se iniciará automáticamente al encender Windows.

### **10.2. Cambiar el puerto (si el 3000 está ocupado)**

Si necesitas usar otro puerto (por ejemplo, 8080):

1. Edita `docker-compose.yml`
2. Cambia la línea:
   ```yaml
   ports:
     - "3000:3000"
   ```
   Por:
   ```yaml
   ports:
     - "8080:3000"
   ```
3. Guarda el archivo
4. Reinicia: `docker-compose restart app`
5. Accede desde: `http://IP_DEL_SERVIDOR:8080`

---

## 🐛 **SOLUCIÓN DE PROBLEMAS**

### **Problema 1: "No puedo acceder desde otra PC"**

**Verificar**:
1. ¿Están en la misma red? (mismo router)
2. ¿El firewall permite el puerto 3000? (Paso 4)
3. ¿Puedes hacer ping al servidor? (`ping IP_SERVIDOR`)
4. ¿Docker está corriendo? (`docker-compose ps`)

**Solución**:
```powershell
# Ver logs de la app
docker-compose logs app

# Reiniciar todo
docker-compose restart
```

### **Problema 2: "Las sesiones de WhatsApp no se comparten"**

**Verificar**:
1. ¿El `docker-compose.yml` usa bind mounts? (debería usar `./sessions`)
2. ¿Las carpetas existen? (Paso 3)

**Solución**:
```powershell
# Ver contenido de sesiones
dir sessions

# Verificar montaje en el contenedor
docker exec whatsapp_app ls -la /app/sessions
```

### **Problema 3: "MySQL no inicia"**

**Solución**:
```powershell
# Ver logs de MySQL
docker-compose logs mysql

# Si hay problemas con permisos, borrar y recrear
docker-compose down -v
docker-compose up -d
```

**⚠️ CUIDADO**: El comando `docker-compose down -v` borra TODOS los datos.

### **Problema 4: "El puerto 3000 ya está en uso"**

**Solución**:
1. Encontrar qué usa el puerto:
   ```powershell
   netstat -ano | findstr :3000
   ```
2. O cambiar el puerto (Paso 10.2)

---

## ✅ **CHECKLIST FINAL**

Antes de dar por terminado, verifica:

- [ ] Docker Desktop está instalado y corriendo
- [ ] El archivo `.env` existe y tiene las contraseñas configuradas
- [ ] Las carpetas (sessions, uploads, etc.) están creadas
- [ ] El firewall permite el puerto 3000
- [ ] Conoces la IP del servidor
- [ ] `docker-compose ps` muestra los 3 contenedores como "healthy"
- [ ] Puedes acceder desde `http://localhost:3000` en el servidor
- [ ] Puedes acceder desde `http://IP_SERVIDOR:3000` desde otra PC
- [ ] Las sesiones de WhatsApp se comparten entre PCs

---

## 🎉 **¡LISTO!**

Ahora tienes:
- ✅ Sistema funcionando en tu servidor Windows
- ✅ Múltiples PCs pueden acceder a través de la red
- ✅ Sesiones de WhatsApp compartidas entre todas las PCs
- ✅ Múltiples usuarios pueden enviar y recibir mensajes simultáneamente

**Próximos pasos recomendados**:
1. Crear usuarios para cada operador
2. Configurar backups automáticos de las sesiones
3. Monitorear los logs regularmente

---

## 📞 **COMANDOS ÚTILES**

Guarda estos comandos para referencia rápida:

```powershell
# Ver estado de los contenedores
docker-compose ps

# Ver logs en tiempo real
docker-compose logs -f app

# Reiniciar solo la aplicación
docker-compose restart app

# Detener todo
docker-compose down

# Iniciar todo
docker-compose up -d

# Ver uso de recursos
docker stats

# Crear backup de la base de datos
docker exec whatsapp_mysql mysqldump -u whatsapp_user -pwhatsapp_pass_2025_seguro whatsapp_masivo > backup.sql
```

---

**¿Tienes problemas?** Revisa la sección de "Solución de Problemas" arriba o consulta los logs con `docker-compose logs -f`.

