# 🔧 Solución de Problemas de Login
TOKEN
## Si recibes error 401 (Unauthorized)

### Opción 1: Verificar en la consola del navegador

1. Abre el navegador en `http://localhost:3000`
2. Presiona `F12` para abrir DevTools
3. Ve a la pestaña **Console**
4. Intenta hacer login
5. Mira si hay algún error en rojo

### Opción 2: Limpiar caché del navegador

1. Presiona `Ctrl + Shift + Delete`
2. Selecciona "Cookies y caché"
3. Limpia
4. Recarga la página (`F5`)

### Opción 3: Probar en modo incógnito

1. `Ctrl + Shift + N` (Chrome)
2. Ve a `http://localhost:3000`
3. Intenta login

### Opción 4: Verificar usuario en base de datos

```bash
node scripts/crear_admin.js
```

Esto recreará el usuario admin con la contraseña correcta.

### Opción 5: Verificar que el servidor esté corriendo

En PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
```

Si no devuelve nada, el servidor no está corriendo. Ejecuta:
```bash
node src/backend/server.js
```

### Opción 6: Revisar archivo .env

Asegúrate de que `.env` tenga:
```env
JWT_SECRET=sordido_whatsapp_masivo_secret_2025_change_in_production
SESSION_SECRET=sordido_session_secret_2025_change_in_production
```

## Credenciales Correctas

**Usuario:** `admin`  
**Contraseña:** `admin123`

(Sin espacios, todo en minúsculas)

## ¿Qué hace el JWT_SECRET?

Cuando haces login:
1. Backend verifica usuario y contraseña ✅
2. Backend crea un TOKEN firmado con JWT_SECRET
3. Frontend guarda el token
4. Cada petición usa ese token para autenticarse

Si JWT_SECRET no existe o está mal, el login fallará.

## ¿El servidor está corriendo?

Abre la ventana de PowerShell donde corre el servidor y busca:

```
✓ Servidor escuchando en puerto 3000
✓ Socket.IO habilitado
📱 Sistema de WhatsApp Masivo listo
```

Si ves eso, el servidor está OK.

## Probar el endpoint de login manualmente

En PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
```

Deberías recibir un token si todo está bien.

