# 🎉 Sistema de Mensajería Masiva WhatsApp - BAILEYS

## ✅ ¡SISTEMA FUNCIONANDO!

Este sistema usa **@whiskeysockets/baileys** (NO usa Chrome/Puppeteer) para conectarse a WhatsApp.

---

## 🚀 Inicio Rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar `.env`
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=whatsapp_masivo
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=tu_secreto_jwt
SESSION_SECRET=tu_secreto_session
```

### 3. Crear base de datos
```bash
mysql -u root -p < database/schema.sql
```

### 4. Crear usuario admin
```bash
node scripts/crear_admin.js
```

### 5. Iniciar servidor
```bash
npm start
```

### 6. Abrir en navegador
```
http://localhost:3000
```

**Login:** admin / admin123

---

## 📱 Conectar WhatsApp

1. Ve a **"Dispositivos"**
2. Click en **"Conectar"**
3. **Escanea el QR** que aparecerá en tu pantalla con WhatsApp
4. ¡Listo! El dispositivo quedará conectado

**IMPORTANTE:** 
- NO se abre ningún navegador (Baileys no usa Chrome)
- El QR aparece directamente en tu dashboard
- La sesión se guarda automáticamente

---

## 📊 Importar Contactos desde Excel

### Estructura del Excel

Tu archivo Excel debe tener estas columnas:

| categoria | telefono | nombre | mensaje |
|-----------|----------|--------|---------|
| BCP | 51900124654 | Carlos Herrera | Hola Carlos, tienes una deuda... |
| INTERBANK | 51956469717 | María González | Hola María, recordatorio... |

### Pasos para Importar

1. Ve a **"Campañas"**
2. Click **"+ Nueva Campaña"**
3. Selecciona tipo: **"Desde Excel"**
4. Sube tu archivo `.xlsx`
5. Selecciona categoría por defecto (opcional)
6. **Click "Crear"**

El sistema importará todos los contactos automáticamente.

### Archivo de Ejemplo

Usa `ejemplo_campana_masiva.xlsx` como referencia.

---

## 🚀 Envío Masivo con Comportamiento Humano

### Características Anti-SPAM

✅ **Pausas Gaussianas**: Pausas aleatorias e impredecibles  
✅ **Lotes Variables**: Estructura de lotes (1-10, 10-20, 20-30, 30-40, 40-50)  
✅ **Rotación de Dispositivos**: Alterna entre dispositivos conectados  
✅ **Comportamiento Humano**: Simula acciones reales  

### Ejemplo de Envío

Para 400 mensajes:

```
Lote 1 (8 mensajes):
  → Envío 1: 4 mensajes (pausa 1-5 seg)
  → Envío 2: 1 mensaje (pausa 1-5 seg)
  → Envío 3: 3 mensajes
  → Pausa entre lotes: 10-40 seg

Lote 2 (15 mensajes):
  → ...continúa con pausas variables
```

### Iniciar Campaña

1. Ve a **"Campañas"**
2. Encuentra tu campaña
3. Click **"Iniciar"**
4. El sistema enviará mensajes automáticamente con pausas inteligentes

---

## 🤖 Comportamiento Humano Automático

Durante el envío, el sistema simula acciones humanas:

- ✅ Cambios de estado
- ✅ Actualizaciones de descripción
- ✅ Reacciones a mensajes
- ✅ Navegación en chats
- ✅ Pausas aleatorias

Todo esto sucede automáticamente para evitar detección de SPAM.

---

## 📁 Estructura del Proyecto

```
Sordido/
├── src/
│   ├── backend/
│   │   ├── server.js                    # Servidor principal
│   │   ├── services/
│   │   │   ├── whatsappServiceBaileys.js  # ⭐ Conexión WhatsApp
│   │   │   ├── campaignService.js          # Campañas
│   │   │   ├── antiSpamService.js          # Anti-SPAM
│   │   │   └── humanBehaviorService.js     # Comportamiento humano
│   │   ├── routes/
│   │   │   ├── uploadRoutes.js             # ⭐ Upload Excel
│   │   │   ├── campaignRoutes.js
│   │   │   └── ...
│   │   └── sockets/
│   │       └── socketHandler.js
│   ├── frontend/
│   │   ├── index.html              # Login
│   │   ├── dashboard.html          # Dashboard principal
│   │   ├── js/app.js              # ⭐ Lógica frontend
│   │   └── css/style.css
│   └── config/
│       ├── database.js
│       └── redis.js
├── database/
│   └── schema.sql
├── sessions/                        # Sesiones de Baileys
├── uploads/                         # Excel subidos
├── ejemplo_campana_masiva.xlsx     # ⭐ Archivo de ejemplo
└── package.json
```

---

## 🔧 Troubleshooting

### El QR no aparece

1. **Verifica que el servidor esté corriendo:**
   ```bash
   Get-NetTCPConnection -LocalPort 3000 -State Listen
   ```

2. **Revisa la consola del servidor** - Deberías ver:
   ```
   🎯🎯🎯 ¡¡¡QR GENERADO!!! 🎯🎯🎯
   ```

3. **Recarga el navegador** (Ctrl + F5)

### Error al importar Excel

- **Verifica las columnas:** categoria, telefono, nombre, mensaje
- **Formato de teléfono:** Debe incluir código de país (ej: 51900124654)
- **Extensión:** Solo `.xlsx` o `.xls`

### Mensajes no se envían

1. **Verifica dispositivo conectado:**
   - Ve a "Dispositivos"
   - Estado debe ser "conectado"

2. **Verifica campaña:**
   - La campaña debe tener mensajes pendientes
   - Debe haber al menos un dispositivo conectado

---

## 📚 Tecnologías Utilizadas

- **Backend:** Node.js + Express
- **WhatsApp:** @whiskeysockets/baileys (sin Puppeteer)
- **Base de Datos:** MySQL
- **Cache:** Redis
- **Tiempo Real:** Socket.IO
- **Excel:** xlsx, multer
- **Frontend:** HTML, CSS, JavaScript (Vanilla)

---

## 🎯 Diferencias con whatsapp-web.js

| whatsapp-web.js | Baileys |
|-----------------|---------|
| ❌ Usa Chrome/Puppeteer | ✅ NO usa navegador |
| ❌ Consume mucha RAM | ✅ Ligero y eficiente |
| ❌ Problemas con Service Workers | ✅ Sin problemas |
| ❌ Requiere Chrome instalado | ✅ No requiere nada extra |
| ✅ Interfaz visual de WhatsApp | ⚠️ Solo protocolo |

---

## 🚨 Importante

- **NO abuses del sistema** - WhatsApp puede banear tu número
- **Respeta los límites** - El sistema ya tiene protecciones anti-SPAM
- **Usa números de prueba primero**
- **Lee la documentación de WhatsApp** sobre uso de bots

---

## 🙋 Soporte

Si tienes problemas:

1. Revisa la consola del servidor
2. Revisa la consola del navegador (F12)
3. Verifica que MySQL y Redis estén corriendo
4. Lee los archivos de troubleshooting

---

## 📝 Licencia

MIT License - Uso bajo tu propia responsabilidad.

---

## 🎉 ¡Listo para usar!

Tu sistema está **completamente funcional** con:

✅ Conexión WhatsApp con Baileys  
✅ Importar Excel con contactos  
✅ Envío masivo inteligente  
✅ Comportamiento humano  
✅ Pausas gaussianas  
✅ Lotes variables  
✅ Rotación de dispositivos  

**¡Disfruta tu sistema de mensajería masiva!** 🚀

