# 📱 Sistema de Mensajería Masiva por WhatsApp
TOKEN
Sistema profesional de mensajería masiva por WhatsApp con funcionalidades anti-SPAM, comportamiento humano simulado y gestión multi-dispositivo.

## 🚀 Características Principales

- ✅ **Multi-dispositivo**: Soporte para hasta 5 sesiones de WhatsApp simultáneas
- ✅ **Anti-SPAM**: Sistema inteligente de pausas y rotación de dispositivos
- ✅ **Comportamiento Humano**: Simulación de actividades humanas para evitar bloqueos
- ✅ **Campañas**: Envío masivo programado con Excel
- ✅ **Categorías**: Organización de contactos por categorías
- ✅ **Agendamiento**: Programación de campañas para fechas específicas
- ✅ **Persistencia**: Sesiones guardadas en Redis
- ✅ **Chat Viewer**: Visualización y respuesta a conversaciones
- ✅ **Exportación**: Descarga de chats en formato Excel
- ✅ **Dashboard**: Interfaz web moderna y responsiva

## 📋 Requisitos Previos

### Software Necesario

1. **Node.js** (v16 o superior)
   - Descargar desde: https://nodejs.org/

2. **MySQL** (v8.0 o superior)
   - Descargar desde: https://dev.mysql.com/downloads/mysql/

3. **Redis** (v6.0 o superior)
   - Windows: https://github.com/tporadowski/redis/releases
   - Linux/Mac: https://redis.io/download

4. **Python** (v3.8 o superior) - Opcional para microservicios
   - Descargar desde: https://www.python.org/downloads/

## 🛠️ Instalación

### 1. Clonar o descargar el proyecto

```bash
cd Sordido
```

### 2. Instalar dependencias de Node.js

```bash
npm install
```

### 3. Instalar dependencias de Python (opcional)

```bash
npm run install-python
# O manualmente:
cd src/microservices
pip install -r requirements.txt
```

### 4. Configurar variables de entorno

Copiar el archivo `.env.example` y renombrarlo a `.env`:

```bash
# En la raíz del proyecto
cp .env.example .env
```

Editar el archivo `.env` con tus configuraciones:

```env
# Puerto del servidor
PORT=3000

# Base de datos MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password_mysql
DB_NAME=whatsapp_masivo
DB_PORT=3306

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Secret (cambiar en producción)
JWT_SECRET=tu_secreto_super_seguro_cambiar_en_produccion

# Session Secret
SESSION_SECRET=tu_secreto_de_sesion_cambiar

# Python Microservice
PYTHON_SERVICE_URL=http://localhost:5000
```

### 5. Configurar Base de Datos

Ejecutar el script SQL para crear la base de datos:

```bash
# Opción 1: Desde línea de comandos
mysql -u root -p < database/schema.sql

# Opción 2: Usando un cliente MySQL (MySQL Workbench, phpMyAdmin, etc.)
# Importar el archivo database/schema.sql
```

El script creará:
- Base de datos `whatsapp_masivo`
- Todas las tablas necesarias
- Usuario administrador por defecto:
  - **Usuario**: `admin`
  - **Contraseña**: `admin123`

### 6. Iniciar Redis

```bash
# Windows
redis-server

# Linux/Mac
redis-server

# Verificar que está corriendo:
redis-cli ping
# Debe responder: PONG
```

## 🎯 Uso

### Iniciar el Servidor Principal

```bash
npm start
# O en modo desarrollo:
npm run dev
```

El servidor estará disponible en: `http://localhost:3000`

### Iniciar Microservicio Python (Opcional)

En otra terminal:

```bash
cd src/microservices
python app.py
```

El microservicio estará en: `http://localhost:5000`

### Acceder al Sistema

1. Abrir navegador en `http://localhost:3000`
2. Iniciar sesión con:
   - **Usuario**: `admin`
   - **Contraseña**: `admin123`

## 📖 Flujo de Uso

### 1. Crear Dispositivos

1. Ir a la sección **Dispositivos**
2. Hacer clic en **+ Nuevo Dispositivo**
3. Asignar nombre y categoría (opcional)
4. Hacer clic en **Conectar**
5. Escanear el código QR con WhatsApp
6. Esperar confirmación de conexión

### 2. Crear Categorías

1. Ir a **Categorías**
2. Hacer clic en **+ Nueva Categoría**
3. Ingresar nombre, descripción y color
4. Asignar dispositivo (opcional)

### 3. Importar Contactos

**Formato del archivo Excel:**

| nombre | telefono | categoria | mensaje |
|--------|----------|-----------|---------|
| Juan | 51999888777 | BCP | Hola Juan |
| María | 51988777666 | Interbank | Hola María |

1. Ir a **Contactos**
2. Hacer clic en **Importar Excel**
3. Seleccionar archivo
4. Los contactos se cargarán automáticamente

### 4. Crear Campaña

1. Ir a **Campañas**
2. Hacer clic en **+ Nueva Campaña**
3. Configurar:
   - Nombre de campaña
   - Seleccionar contactos
   - Asignar dispositivos a categorías
4. Hacer clic en **Iniciar** o **Agendar**

### 5. Envío Manual

1. Ir a **Envío Manual**
2. Seleccionar dispositivo conectado
3. Ingresar números separados por coma: `51999888777, 51988777666`
4. Escribir mensaje
5. Hacer clic en **Enviar Mensajes**

### 6. Ver y Responder Chats

1. Ir a **Chats**
2. Seleccionar dispositivo
3. Elegir conversación
4. Ver mensajes y responder
5. Descargar chat individual o por categoría

## ⚙️ Configuración Anti-SPAM

El sistema implementa múltiples estrategias anti-SPAM:

### Sistema de Lotes

```
Mensajes totales: 400

Lote 1 (1-10 mensajes aleatorio)
├─ Batch 1: 4 mensajes → Pausa 500-1000ms
├─ Batch 2: 1 mensaje → Pausa 500-1000ms
└─ Batch 3: 3 mensajes → Pausa 5-10s

Pausa entre lotes: 10-40 segundos

Lote 2 (10-20 mensajes aleatorio)
└─ ...

Y así sucesivamente con distribución gaussiana
```

### Comportamiento Humano

Entre lotes, el sistema ejecuta aleatoriamente:
- ✍️ Cambio de estado de WhatsApp
- 📝 Cambio de descripción
- 👁️ Lectura de mensajes
- 👍 Reacciones a mensajes
- 🔄 Scroll en chats
- ⚙️ Cambio de configuración

### Rotación de Dispositivos

En campañas multi-dispositivo:
1. Se rota aleatoriamente entre dispositivos
2. Cada dispositivo maneja su categoría
3. Pausas variables entre rotaciones

## 🗂️ Estructura del Proyecto

```
Sordido/
├── src/
│   ├── backend/
│   │   ├── server.js              # Servidor principal
│   │   ├── routes/                # Rutas de API
│   │   │   ├── authRoutes.js
│   │   │   ├── deviceRoutes.js
│   │   │   ├── campaignRoutes.js
│   │   │   ├── contactRoutes.js
│   │   │   ├── categoryRoutes.js
│   │   │   └── chatRoutes.js
│   │   ├── services/              # Lógica de negocio
│   │   │   ├── whatsappService.js
│   │   │   ├── campaignService.js
│   │   │   ├── antiSpamService.js
│   │   │   ├── humanBehaviorService.js
│   │   │   └── schedulerService.js
│   │   ├── middleware/            # Middleware
│   │   │   └── auth.js
│   │   └── sockets/               # Socket.IO handlers
│   │       └── socketHandler.js
│   ├── config/                    # Configuraciones
│   │   ├── database.js
│   │   └── redis.js
│   ├── frontend/                  # Frontend
│   │   ├── index.html
│   │   ├── dashboard.html
│   │   ├── css/
│   │   │   └── style.css
│   │   └── js/
│   │       └── app.js
│   └── microservices/             # Microservicio Python
│       ├── app.py
│       └── requirements.txt
├── database/
│   └── schema.sql                 # Script SQL
├── uploads/                       # Archivos subidos
├── downloads/                     # Archivos generados
├── chats/                         # Chats exportados
├── sessions/                      # Sesiones WhatsApp
├── package.json
├── .env.example
└── README.md
```

## 👤 Gestión de Usuarios

### Crear Nuevo Usuario (Solo Admin)

Conectarse a MySQL y ejecutar:

```sql
INSERT INTO usuarios (username, password, nombre_completo, email, rol) 
VALUES (
    'nuevo_usuario', 
    '$2a$10$xQPXJjKjK8LqXxR9GhGYYOzZhzKZfYHZyHvPJZLvKvDZhYNQDYQWK', -- admin123
    'Nombre Completo',
    'email@ejemplo.com',
    'operador'
);
```

Para generar un nuevo hash de contraseña:

```javascript
const bcrypt = require('bcryptjs');
const password = 'mi_password';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
```

## 🔧 Solución de Problemas

### Error: "Cannot find module"

```bash
rm -rf node_modules package-lock.json
npm install
```

### Error de conexión a MySQL

1. Verificar que MySQL está corriendo
2. Verificar credenciales en `.env`
3. Verificar que la base de datos existe

### Error de conexión a Redis

1. Iniciar Redis: `redis-server`
2. Verificar: `redis-cli ping`

### QR no se muestra

1. Verificar que el dispositivo no está ya conectado
2. Revisar logs del servidor
3. Limpiar sesiones: eliminar carpeta `sessions/`

### Mensajes no se envían

1. Verificar que el dispositivo está conectado (estado: "conectado")
2. Revisar formato de números de teléfono (ejemplo: 51999888777)
3. Verificar logs del servidor

## 📊 API REST

### Autenticación

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

### Dispositivos

```http
GET /api/devices
Authorization: Bearer {token}

POST /api/devices
DELETE /api/devices/:id
```

### Campañas

```http
GET /api/campaigns
POST /api/campaigns
POST /api/campaigns/:id/start
POST /api/campaigns/:id/pause
```

## 🔒 Seguridad

### Recomendaciones para Producción

1. **Cambiar secretos en `.env`**
   - JWT_SECRET
   - SESSION_SECRET

2. **Usar HTTPS**
   - Configurar SSL/TLS

3. **Firewall**
   - Cerrar puertos innecesarios
   - Solo permitir acceso autorizado

4. **Contraseñas fuertes**
   - Cambiar password de admin
   - Usar contraseñas complejas

5. **Backup**
   - Base de datos
   - Carpeta sessions/
   - Archivos importantes

## 🤝 Soporte

Para problemas o preguntas:
1. Revisar logs del servidor
2. Verificar configuración de `.env`
3. Consultar sección de solución de problemas

## 📝 Notas Importantes

- ⚠️ El uso de este sistema debe cumplir con los términos de servicio de WhatsApp
- ⚠️ Evitar envíos masivos muy agresivos para prevenir bloqueos
- ⚠️ Hacer pruebas con números propios primero
- ⚠️ Respetar las pausas configuradas en el sistema anti-SPAM
- ⚠️ No compartir credenciales de acceso

## 📜 Licencia

Este proyecto es de uso interno y educativo.

## 🎉 Créditos

Desarrollado con:
- Node.js + Express
- Socket.IO
- whatsapp-web.js
- MySQL
- Redis
- Python + Flask

---

**¡Sistema listo para usar! 🚀**

Para iniciar:
1. `npm install`
2. Configurar `.env`
3. Importar `database/schema.sql`
4. `redis-server` (en otra terminal)
5. `npm start`
6. Abrir `http://localhost:3000`

Hash correcto: $2a$10$6GS3ZwheAhA6B5.c6MEFOO.o.ghZrKFrcmcuQPJr9YDOah38xspQG
