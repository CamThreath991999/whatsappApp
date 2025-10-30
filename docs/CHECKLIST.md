# ✅ Checklist de Instalación y Configuración

Usa esta lista para verificar que todo esté correctamente configurado.

## 📦 Pre-requisitos

- [ ] Node.js instalado (v16+)
  ```bash
  node --version
  ```

- [ ] MySQL instalado y corriendo
  ```bash
  mysql --version
  ```

- [ ] Redis instalado y corriendo
  ```bash
  redis-cli ping
  # Debe responder: PONG
  ```

- [ ] Python instalado (opcional)
  ```bash
  python --version
  ```

## 🔧 Instalación

- [ ] Dependencias de Node.js instaladas
  ```bash
  npm install
  ```

- [ ] Base de datos MySQL creada
  ```bash
  mysql -u root -p < database/schema.sql
  ```

- [ ] Archivo `.env` configurado
  - [ ] DB_PASSWORD configurado
  - [ ] JWT_SECRET cambiado (producción)
  - [ ] SESSION_SECRET cambiado (producción)

- [ ] Carpetas creadas:
  - [ ] `uploads/`
  - [ ] `downloads/`
  - [ ] `chats/`
  - [ ] `sessions/`

## 🧪 Tests de Conexión

- [ ] Test de conexiones ejecutado
  ```bash
  node scripts/test_connection.js
  ```
  
- [ ] MySQL conecta correctamente ✅
- [ ] Redis conecta correctamente ✅

## 🚀 Primer Inicio

- [ ] Redis iniciado en una terminal
  ```bash
  redis-server
  ```

- [ ] Servidor iniciado en otra terminal
  ```bash
  npm start
  ```

- [ ] Navegador abierto en `http://localhost:3000`

- [ ] Login exitoso con:
  - Usuario: `admin`
  - Password: `admin123`

## 📱 Primera Configuración

- [ ] Dispositivo creado
- [ ] QR escaneado
- [ ] Dispositivo conectado (estado: "Conectado")
- [ ] Categoría creada
- [ ] Contacto de prueba agregado
- [ ] Mensaje de prueba enviado exitosamente

## 🎯 Funcionalidades Verificadas

### Dispositivos
- [ ] Crear dispositivo
- [ ] Conectar con QR
- [ ] Ver estado de conexión
- [ ] Desconectar dispositivo
- [ ] Eliminar dispositivo

### Categorías
- [ ] Crear categoría
- [ ] Asignar color
- [ ] Ver cantidad de contactos
- [ ] Editar categoría
- [ ] Eliminar categoría

### Contactos
- [ ] Crear contacto manual
- [ ] Importar desde Excel
- [ ] Filtrar por categoría
- [ ] Cambiar categoría de contacto
- [ ] Eliminar contacto

### Campañas
- [ ] Crear campaña
- [ ] Configurar mensajes
- [ ] Iniciar campaña
- [ ] Ver progreso en tiempo real
- [ ] Pausar campaña
- [ ] Reanudar campaña
- [ ] Cancelar campaña

### Envío Manual
- [ ] Seleccionar dispositivo
- [ ] Enviar a múltiples números
- [ ] Ver confirmación de envío

### Chats
- [ ] Ver lista de conversaciones
- [ ] Abrir chat
- [ ] Ver mensajes
- [ ] Responder mensaje
- [ ] Descargar chat

### Agendamiento
- [ ] Agendar campaña para fecha futura
- [ ] Ver campañas agendadas
- [ ] Cancelar agendamiento

## 🔒 Seguridad (Producción)

- [ ] Cambiar password de admin
- [ ] Cambiar JWT_SECRET
- [ ] Cambiar SESSION_SECRET
- [ ] Configurar HTTPS
- [ ] Configurar firewall
- [ ] Crear usuarios adicionales con permisos limitados
- [ ] Realizar backup de:
  - [ ] Base de datos MySQL
  - [ ] Carpeta `sessions/`
  - [ ] Carpeta `chats/`

## 🐛 Solución de Problemas Verificada

- [ ] Probado reinicio de servidor
- [ ] Probado reconexión de dispositivo
- [ ] Verificado logs en caso de error
- [ ] Documentación consultada en caso de dudas

## 📊 Métricas de Rendimiento

- [ ] Sistema responde en menos de 2 segundos
- [ ] Mensajes se envían correctamente
- [ ] Pausas anti-SPAM funcionan
- [ ] Comportamiento humano se ejecuta
- [ ] Rotación de dispositivos funciona (multi-dispositivo)

## 🎓 Capacitación

- [ ] README.md leído completamente
- [ ] INSTALACION.md consultado
- [ ] INICIO_RAPIDO.md probado
- [ ] Flujo completo de campaña ejecutado
- [ ] Scripts de utilidad probados:
  - [ ] `scripts/create_user.js`
  - [ ] `scripts/hash_password.js`
  - [ ] `scripts/test_connection.js`

## ✨ Extras (Opcional)

- [ ] Microservicio Python instalado y funcionando
- [ ] Exportación de contactos a Excel probada
- [ ] Exportación de chats a Excel probada
- [ ] Limpieza de archivos antiguos configurada
- [ ] Monitoreo de logs implementado

## 📝 Notas Adicionales

```
Fecha de instalación: ______________
Instalado por: ______________
Versión de Node.js: ______________
Versión de MySQL: ______________
Versión de Redis: ______________

Problemas encontrados:
_________________________________
_________________________________
_________________________________

Soluciones aplicadas:
_________________________________
_________________________________
_________________________________
```

## ✅ Estado Final

- [ ] **Sistema completamente funcional**
- [ ] **Todos los tests pasados**
- [ ] **Documentación revisada**
- [ ] **Backup realizado**
- [ ] **Capacitación completada**

---

**Fecha de verificación completa:** _______________

**Firma:** _______________

🎉 **¡Sistema listo para producción!**

