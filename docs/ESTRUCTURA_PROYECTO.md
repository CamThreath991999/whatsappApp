# 📁 Estructura Completa del Proyecto

Este documento describe la organización de todos los archivos y carpetas del sistema.
# # 
## 🌳 Árbol de Directorios

```
Sordido/
│
├── 📄 package.json                    # Dependencias Node.js
├── 📄 .gitignore                      # Archivos ignorados por Git
├── 📄 .env                            # Variables de entorno (NO subir a Git)
├── 📄 README.md                       # Documentación principal
├── 📄 INSTALACION.md                  # Guía de instalación detallada
├── 📄 INICIO_RAPIDO.md                # Inicio rápido en 5 minutos
├── 📄 CHECKLIST.md                    # Checklist de verificación
├── 📄 ESTRUCTURA_PROYECTO.md          # Este archivo
├── 📄 ejemplo_contactos.xlsx          # Ejemplo de Excel para importar
│
├── 📂 database/
│   └── schema.sql                     # Script SQL completo
│
├── 📂 scripts/                        # Scripts de utilidad
│   ├── create_user.js                 # Crear usuarios desde CLI
│   ├── hash_password.js               # Generar hash de contraseñas
│   └── test_connection.js             # Verificar conexiones
│
├── 📂 src/
│   │
│   ├── 📂 backend/                    # Backend Node.js
│   │   │
│   │   ├── server.js                  # Servidor principal Express
│   │   │
│   │   ├── 📂 routes/                 # Rutas de la API REST
│   │   │   ├── authRoutes.js          # Login, logout, verificación
│   │   │   ├── deviceRoutes.js        # CRUD dispositivos
│   │   │   ├── campaignRoutes.js      # CRUD campañas
│   │   │   ├── contactRoutes.js       # CRUD contactos
│   │   │   ├── categoryRoutes.js      # CRUD categorías
│   │   │   └── chatRoutes.js          # Gestión de chats
│   │   │
│   │   ├── 📂 services/               # Lógica de negocio
│   │   │   ├── whatsappService.js     # Gestión de WhatsApp Web
│   │   │   ├── campaignService.js     # Ejecución de campañas
│   │   │   ├── antiSpamService.js     # Sistema anti-SPAM
│   │   │   ├── humanBehaviorService.js # Comportamiento humano
│   │   │   └── schedulerService.js    # Agendamiento de campañas
│   │   │
│   │   ├── 📂 middleware/             # Middleware Express
│   │   │   └── auth.js                # Verificación JWT
│   │   │
│   │   └── 📂 sockets/                # Socket.IO handlers
│   │       └── socketHandler.js       # Eventos WebSocket
│   │
│   ├── 📂 config/                     # Configuraciones
│   │   ├── database.js                # Conexión MySQL
│   │   └── redis.js                   # Conexión Redis
│   │
│   ├── 📂 frontend/                   # Frontend HTML/CSS/JS
│   │   │
│   │   ├── index.html                 # Página de login
│   │   ├── dashboard.html             # Dashboard principal
│   │   │
│   │   ├── 📂 css/
│   │   │   └── style.css              # Estilos completos
│   │   │
│   │   └── 📂 js/
│   │       └── app.js                 # Lógica frontend
│   │
│   └── 📂 microservices/              # Microservicio Python
│       ├── app.py                     # API Flask
│       └── requirements.txt           # Dependencias Python
│
├── 📂 uploads/                        # Archivos subidos (Excel)
├── 📂 downloads/                      # Archivos generados
├── 📂 chats/                          # Chats exportados por contacto
└── 📂 sessions/                       # Sesiones de WhatsApp persistentes

```

## 📦 Archivos Principales por Categoría

### 🔐 Autenticación y Seguridad

| Archivo | Descripción |
|---------|-------------|
| `src/backend/routes/authRoutes.js` | Login, logout, verificación de token |
| `src/backend/middleware/auth.js` | Middleware de autenticación JWT |
| `.env` | Variables de entorno y secretos |

### 📱 Gestión de WhatsApp

| Archivo | Descripción |
|---------|-------------|
| `src/backend/services/whatsappService.js` | Conexión y gestión de WhatsApp Web |
| `src/backend/routes/deviceRoutes.js` | API para dispositivos |
| `src/backend/sockets/socketHandler.js` | Eventos en tiempo real (QR, mensajes) |

### 📤 Campañas y Envíos

| Archivo | Descripción |
|---------|-------------|
| `src/backend/services/campaignService.js` | Ejecución de campañas masivas |
| `src/backend/services/antiSpamService.js` | Lógica anti-SPAM y pausas |
| `src/backend/services/humanBehaviorService.js` | Simulación de comportamiento humano |
| `src/backend/routes/campaignRoutes.js` | API para campañas |

### 👥 Contactos y Categorías

| Archivo | Descripción |
|---------|-------------|
| `src/backend/routes/contactRoutes.js` | API para contactos |
| `src/backend/routes/categoryRoutes.js` | API para categorías |
| `ejemplo_contactos.xlsx` | Plantilla de Excel |

### 🕐 Agendamiento

| Archivo | Descripción |
|---------|-------------|
| `src/backend/services/schedulerService.js` | Sistema de agendamiento con cron |

### 💬 Chats

| Archivo | Descripción |
|---------|-------------|
| `src/backend/routes/chatRoutes.js` | API para visualización de chats |

### 🗄️ Base de Datos

| Archivo | Descripción |
|---------|-------------|
| `database/schema.sql` | Script SQL completo con todas las tablas |
| `src/config/database.js` | Pool de conexiones MySQL |
| `src/config/redis.js` | Cliente Redis y helpers |

### 🎨 Frontend

| Archivo | Descripción |
|---------|-------------|
| `src/frontend/index.html` | Página de login |
| `src/frontend/dashboard.html` | Dashboard con todas las vistas |
| `src/frontend/css/style.css` | Estilos completos y responsivos |
| `src/frontend/js/app.js` | Lógica del frontend, Socket.IO, API calls |

### 🐍 Microservicio Python

| Archivo | Descripción |
|---------|-------------|
| `src/microservices/app.py` | API Flask para exportación de Excel |
| `src/microservices/requirements.txt` | Dependencias Python |

### 🛠️ Utilidades

| Archivo | Descripción |
|---------|-------------|
| `scripts/create_user.js` | Crear usuarios desde terminal |
| `scripts/hash_password.js` | Generar hash bcrypt |
| `scripts/test_connection.js` | Verificar MySQL y Redis |

### 📚 Documentación

| Archivo | Descripción |
|---------|-------------|
| `README.md` | Documentación principal completa |
| `INSTALACION.md` | Guía de instalación paso a paso |
| `INICIO_RAPIDO.md` | Inicio en 5 minutos |
| `CHECKLIST.md` | Lista de verificación |
| `ESTRUCTURA_PROYECTO.md` | Este archivo |

## 🔄 Flujo de Datos

```
┌─────────────┐
│  Navegador  │
└──────┬──────┘
       │
       ├─── HTTP/REST ────▶ Express Server (server.js)
       │                        │
       └─── WebSocket ────▶ Socket.IO (socketHandler.js)
                                │
                                ├─── WhatsApp Service
                                │       │
                                │       └─── whatsapp-web.js
                                │
                                ├─── Campaign Service
                                │       │
                                │       ├─── Anti-SPAM Service
                                │       └─── Human Behavior Service
                                │
                                ├─── MySQL (contactos, campañas, etc.)
                                │
                                ├─── Redis (sesiones, cache, colas)
                                │
                                └─── Python Microservice (exportación)
```

## 📊 Esquema de Base de Datos

### Tablas Principales

1. **usuarios** - Usuarios del sistema
2. **dispositivos** - Dispositivos/sesiones WhatsApp
3. **categorias** - Categorías de contactos
4. **contactos** - Base de contactos
5. **campanas** - Campañas de envío masivo
6. **mensajes** - Mensajes individuales de campañas
7. **chats** - Conversaciones
8. **comportamiento_log** - Log de comportamiento humano
9. **system_logs** - Logs del sistema

### Relaciones

```
usuarios (1) ──── (N) dispositivos
usuarios (1) ──── (N) categorias
usuarios (1) ──── (N) contactos
usuarios (1) ──── (N) campanas

categorias (1) ──── (N) contactos
categorias (1) ──── (1) dispositivos

campanas (1) ──── (N) mensajes
contactos (1) ──── (N) mensajes
dispositivos (1) ──── (N) mensajes
```

## 🚀 Puntos de Entrada

### Servidor Principal
```bash
npm start  # Inicia server.js
```

### Microservicio Python
```bash
cd src/microservices && python app.py
```

### Frontend
```
http://localhost:3000
```

### API REST
```
http://localhost:3000/api/*
```

### Socket.IO
```
ws://localhost:3000
```

## 🔑 Variables de Entorno Importantes

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `3000` |
| `DB_HOST` | Host MySQL | `localhost` |
| `DB_USER` | Usuario MySQL | `root` |
| `DB_PASSWORD` | Password MySQL | `password` |
| `DB_NAME` | Base de datos | `whatsapp_masivo` |
| `REDIS_HOST` | Host Redis | `localhost` |
| `REDIS_PORT` | Puerto Redis | `6379` |
| `JWT_SECRET` | Secret para JWT | `cambiar_en_produccion` |

## 📝 Notas de Implementación

### Tecnologías Usadas

**Backend:**
- Node.js v16+
- Express.js v4
- Socket.IO v4
- whatsapp-web.js v1.23+
- MySQL2
- Redis
- JWT para autenticación
- Bcrypt para passwords

**Frontend:**
- HTML5
- CSS3 (vanilla)
- JavaScript (vanilla)
- Socket.IO client

**Microservicio:**
- Python 3.8+
- Flask
- Pandas
- OpenPyXL

### Patrones de Diseño

- **MVC**: Separación modelo-vista-controlador
- **Service Layer**: Lógica de negocio en servicios
- **Repository Pattern**: Acceso a datos centralizado
- **Middleware Pattern**: Para autenticación y validación
- **Observer Pattern**: Socket.IO para eventos en tiempo real

## 🎯 Funcionalidades por Archivo

### server.js
- Inicialización de Express
- Configuración de middleware
- Montaje de rutas
- Inicialización de Socket.IO
- Manejo de errores global

### whatsappService.js
- Crear/destruir sesiones WhatsApp
- Enviar mensajes
- Recibir mensajes
- Obtener chats
- Formatear números de teléfono

### campaignService.js
- Crear campañas
- Ejecutar envío masivo
- Pausar/reanudar campañas
- Gestionar progreso
- Emitir eventos en tiempo real

### antiSpamService.js
- Calcular estructura de lotes
- Generar pausas aleatorias
- Distribución gaussiana
- Rotación de dispositivos
- Generar reportes de tiempo

### humanBehaviorService.js
- Cambiar estado WhatsApp
- Cambiar descripción
- Simular scroll
- Leer mensajes
- Reaccionar a mensajes
- Ejecutar secuencias aleatorias

---

**Este documento describe la estructura completa del proyecto.** 📚

Para más información, consulta los otros archivos de documentación.

