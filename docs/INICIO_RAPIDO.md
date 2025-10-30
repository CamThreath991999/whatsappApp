# 🚀 Inicio Rápido

Guía rápida para poner el sistema en marcha en 5 minutos.

## ⚡ Pasos Rápidos

### 1. Verificar que tienes instalado:
- ✅ Node.js (v16+)
- ✅ MySQL (v8+)
- ✅ Redis (v6+)

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar base de datos

```bash
# Importar base de datos
mysql -u root -p < database/schema.sql
```

### 4. Configurar .env

El archivo `.env` ya está creado. Solo edita:

```env
DB_PASSWORD=tu_password_mysql
```

### 5. Iniciar Redis

```bash
# Terminal 1
redis-server
```

### 6. Iniciar servidor

```bash
# Terminal 2
npm start
```

### 7. Abrir navegador

```
http://localhost:3000
```

**Login:**
- Usuario: `admin`
- Password: `admin123`

## 📱 Primera Prueba

### Conectar WhatsApp (2 minutos)

1. Click en **+ Nuevo Dispositivo**
2. Nombre: "Mi WhatsApp"
3. Click en **Conectar**
4. Escanear QR con tu WhatsApp
5. ¡Listo! ✅

### Enviar mensaje de prueba (1 minuto)

1. Ir a **Envío Manual**
2. Seleccionar dispositivo
3. Poner tu número: `51999123456`
4. Mensaje: "Prueba desde el sistema"
5. Click en **Enviar**

## 🎯 Siguiente Paso: Campaña

### Crear campaña completa (5 minutos)

1. **Crear Categoría**
   - Ir a "Categorías"
   - Click "+ Nueva Categoría"
   - Nombre: "Clientes"

2. **Importar Contactos**
   - Crear Excel con:
     - Columnas: nombre | telefono | categoria | mensaje
     - Ejemplo: Juan | 51999888777 | Clientes | Hola Juan
   - Ir a "Contactos"
   - "Importar Excel"

3. **Crear Campaña**
   - Ir a "Campañas"
   - "+ Nueva Campaña"
   - Configurar y click "Iniciar"

¡El sistema enviará automáticamente con pausas anti-SPAM! 🎉

## 🆘 Problemas Comunes

### "Cannot connect to MySQL"
```bash
# Verificar que MySQL está corriendo
services.msc (Windows)
# o
sudo systemctl status mysql (Linux)
```

### "Redis connection refused"
```bash
# Iniciar Redis
redis-server
```

### "Port 3000 already in use"
Editar `.env`:
```env
PORT=3001
```

## 📚 Más Información

- **Instalación detallada**: Ver `INSTALACION.md`
- **Documentación completa**: Ver `README.md`
- **Crear usuarios**: `node scripts/create_user.js`
- **Test de conexiones**: `node scripts/test_connection.js`

---

**¿Todo funcionó? ¡Perfecto! 🎉**
**¿Algún error? Consulta `INSTALACION.md` para guía detallada.**

