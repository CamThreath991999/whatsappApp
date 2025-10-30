# 📦 Guía de Instalación Paso a Paso

Esta guía te ayudará a instalar y configurar el sistema desde cero.

## ✅ Verificar Requisitos

### 1. Node.js

Abrir terminal y ejecutar:

```bash
node --version
```

Debe mostrar v16.0.0 o superior. Si no está instalado:
- Descargar desde: https://nodejs.org/
- Instalar versión LTS
- Reiniciar terminal

### 2. MySQL

```bash
mysql --version
```

Si no está instalado:
- Windows: https://dev.mysql.com/downloads/installer/
- Mac: `brew install mysql`
- Linux: `sudo apt-get install mysql-server`

### 3. Redis

Windows:
- Descargar desde: https://github.com/tporadowski/redis/releases
- Instalar y ejecutar como servicio

Mac:
```bash
brew install redis
brew services start redis
```

Linux:
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

Verificar:
```bash
redis-cli ping
# Debe responder: PONG
```

### 4. Python (Opcional)

```bash
python --version
# o
python3 --version
```

## 📥 Instalación del Sistema

### Paso 1: Ubicarse en el directorio del proyecto

```bash
cd C:\Users\mmois\Documents\informaEtc\Sordido
```

### Paso 2: Instalar dependencias de Node.js

```bash
npm install
```

Este comando instalará todas las dependencias necesarias (puede tomar varios minutos).

### Paso 3: Configurar MySQL

1. Abrir MySQL (Workbench, phpMyAdmin, o línea de comandos)

2. Ejecutar el script SQL:

**Opción A - Línea de comandos:**
```bash
mysql -u root -p < database/schema.sql
```

**Opción B - MySQL Workbench:**
- File → Open SQL Script → Seleccionar `database/schema.sql`
- Ejecutar script (icono del rayo ⚡)

3. Verificar que se creó la base de datos:
```sql
SHOW DATABASES;
USE whatsapp_masivo;
SHOW TABLES;
```

### Paso 4: Configurar archivo .env

El archivo `.env` ya está creado. Edítalo con tus datos:

```env
# IMPORTANTE: Cambiar estos valores
DB_USER=root
DB_PASSWORD=TU_PASSWORD_MYSQL_AQUI
```

Dejar el resto como está (a menos que uses puertos diferentes).

### Paso 5: Verificar conexiones

```bash
node scripts/test_connection.js
```

Debes ver:
```
✅ MySQL: Conexión exitosa
✅ Redis: Conexión exitosa
```

Si hay errores, revisar:
- MySQL está corriendo
- Redis está corriendo (`redis-server`)
- Credenciales en `.env` son correctas

## 🚀 Primer Inicio

### 1. Iniciar Redis (si no está corriendo)

```bash
redis-server
```

Dejar esta terminal abierta.

### 2. Iniciar el servidor (en otra terminal)

```bash
cd C:\Users\mmois\Documents\informaEtc\Sordido
npm start
```

Debes ver:
```
🚀 Iniciando servidor...
✓ Conexión MySQL establecida correctamente
✓ Conectado a Redis
✓ Servidor escuchando en puerto 3000
✓ URL: http://localhost:3000
```

### 3. Abrir en navegador

Ir a: http://localhost:3000

### 4. Iniciar sesión

- **Usuario**: `admin`
- **Contraseña**: `admin123`

## 🎯 Primeros Pasos

### 1. Crear un dispositivo

1. Click en **+ Nuevo Dispositivo**
2. Nombre: "Dispositivo 1"
3. Click en **Conectar**
4. Escanear QR con WhatsApp
5. Esperar mensaje de confirmación

### 2. Crear una categoría

1. Ir a **Categorías**
2. Click en **+ Nueva Categoría**
3. Nombre: "Prueba"
4. Seleccionar color
5. Guardar

### 3. Importar contactos

Crear archivo Excel con este formato:

| nombre | telefono | categoria | mensaje |
|--------|----------|-----------|---------|
| Test | 51999123456 | Prueba | Mensaje de prueba |

1. Ir a **Contactos**
2. Click en **Importar Excel**
3. Seleccionar archivo
4. Verificar que se importaron

### 4. Envío manual de prueba

1. Ir a **Envío Manual**
2. Seleccionar dispositivo conectado
3. Poner tu número: `51999123456`
4. Mensaje: "Hola, esto es una prueba"
5. Click en **Enviar Mensajes**

## 🔧 Solución de Problemas Comunes

### Error: "Cannot find module"

```bash
rm -rf node_modules
rm package-lock.json
npm install
```

### Error: "ECONNREFUSED" en MySQL

1. Verificar que MySQL está corriendo:
```bash
# Windows
services.msc
# Buscar MySQL y verificar que está iniciado
```

2. Verificar puerto en `.env` (por defecto 3306)

3. Probar conexión:
```bash
mysql -u root -p
```

### Error: "Redis connection refused"

1. Iniciar Redis:
```bash
redis-server
```

2. Si usa password, agregarlo en `.env`:
```env
REDIS_PASSWORD=tu_password
```

### QR no aparece

1. Limpiar sesiones antiguas:
```bash
# Eliminar carpeta sessions/
rm -rf sessions
```

2. Reiniciar servidor
3. Intentar nuevamente

### Puerto 3000 ya está en uso

Cambiar puerto en `.env`:
```env
PORT=3001
```

Reiniciar servidor y acceder a `http://localhost:3001`

## 🐍 Instalar Microservicio Python (Opcional)

### 1. Instalar pip (si no está instalado)

```bash
python -m pip --version
```

### 2. Instalar dependencias

```bash
cd src/microservices
pip install -r requirements.txt
```

### 3. Iniciar microservicio

```bash
python app.py
```

En otra terminal (el servidor principal debe seguir corriendo).

## 📝 Crear Usuario Adicional

### Opción 1: Script automático

```bash
node scripts/create_user.js
```

Seguir las instrucciones.

### Opción 2: SQL directo

```sql
-- Primero generar hash de password
-- node scripts/hash_password.js mi_password

INSERT INTO usuarios (username, password, nombre_completo, email, rol) 
VALUES (
    'nuevo_usuario',
    '$2a$10$...', -- Hash generado
    'Nombre Usuario',
    'email@ejemplo.com',
    'operador'
);
```

## ✅ Verificación Final

Ejecutar test completo:

```bash
node scripts/test_connection.js
```

Debe mostrar todo en verde ✅.

Si todo está bien, ¡el sistema está listo para usar! 🎉

## 🆘 ¿Necesitas Ayuda?

1. Revisar logs del servidor en la terminal
2. Verificar archivo `.env`
3. Consultar README.md principal
4. Revisar esta guía paso a paso

---

**¡Instalación completada! 🚀**

