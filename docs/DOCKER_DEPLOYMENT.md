# 🐳 Guía de Despliegue Docker - Sistema WhatsApp Masivo
## Acceso Multi-PC con Sesiones Compartidas

---

## 📋 **Tabla de Contenidos**

1. [Arquitectura Multi-PC](#arquitectura-multi-pc)
2. [Requisitos Previos](#requisitos-previos)
3. [Instalación y Configuración](#instalación-y-configuración)
4. [Opciones de Despliegue](#opciones-de-despliegue)
5. [Acceso desde Múltiples PCs](#acceso-desde-múltiples-pcs)
6. [Mantenimiento y Backups](#mantenimiento-y-backups)
7. [Troubleshooting](#troubleshooting)

---

## 🏗️ **Arquitectura Multi-PC**

### Concepto

Este sistema permite que **múltiples usuarios** accedan desde **diferentes PCs** al mismo sistema con:

- ✅ **Base de datos compartida** (MySQL)
- ✅ **Sesiones de WhatsApp compartidas** (Volúmenes Docker)
- ✅ **Cache compartido** (Redis)
- ✅ **Escalabilidad horizontal**

### Flujo de Trabajo

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  PC Jefe    │      │   PC Área   │      │  PC Área 2  │
│ (Escanea QR)│      │ (Operador 1)│      │ (Operador 2)│
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       │                    │                     │
       └────────────────────┼─────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  Servidor o    │
                    │  Red Local     │
                    │  192.168.x.x   │
                    └───────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐        ┌─────▼─────┐      ┌─────▼─────┐
   │  MySQL  │        │  Redis    │      │  App Node │
   │  (BD)   │        │  (Cache)  │      │  (Backend)│
   └─────────┘        └───────────┘      └───────────┘
        │                   │                   │
        └───────────────────┴───────────────────┘
                            │
                    Volúmenes Docker
                    (Sesiones WhatsApp)
```

---

## 💻 **Requisitos Previos**

### Software Necesario

1. **Docker Desktop** (Windows/Mac) o **Docker Engine** (Linux)
   - Windows: https://www.docker.com/products/docker-desktop/
   - Linux: `curl -fsSL https://get.docker.com | sh`

2. **Docker Compose**
   - Incluido en Docker Desktop
   - Linux: `sudo apt install docker-compose`

3. **Git** (para clonar el repositorio)
   - https://git-scm.com/downloads

### Hardware Mínimo

- **RAM**: 4GB (recomendado 8GB)
- **CPU**: 2 cores
- **Disco**: 10GB libres
- **Red**: Conexión estable

---

## 🚀 **Instalación y Configuración**

### **Paso 1: Clonar el Repositorio**

```bash
git clone https://github.com/tu-usuario/expressDb.git
cd expressDb
```

### **Paso 2: Configurar Variables de Entorno**

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar .env con tus valores (IMPORTANTE: Cambiar las contraseñas)
nano .env  # o usa tu editor preferido
```

**Cambiar obligatoriamente:**
```env
MYSQL_ROOT_PASSWORD=TU_PASSWORD_SEGURO_AQUI
MYSQL_PASSWORD=TU_PASSWORD_USUARIO_AQUI
JWT_SECRET=TU_SECRET_JWT_LARGO_Y_ALEATORIO
SESSION_SECRET=TU_SECRET_SESSION_LARGO_Y_ALEATORIO
```

### **Paso 3: Construir e Iniciar los Contenedores**

```bash
# Construir las imágenes
docker-compose build

# Iniciar todos los servicios
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f app
```

### **Paso 4: Verificar que Todo Esté Corriendo**

```bash
# Ver estado de contenedores
docker-compose ps

# Debería mostrar:
#   whatsapp_mysql   - Up (healthy)
#   whatsapp_redis   - Up (healthy)
#   whatsapp_app     - Up (healthy)
```

### **Paso 5: Acceder al Sistema**

Abrir navegador en: `http://localhost:3000`

**Login por defecto:**
- Usuario: `admin`
- Contraseña: `admin123`

⚠️ **IMPORTANTE: Cambiar la contraseña inmediatamente después del primer login**

---

## 📦 **Opciones de Despliegue**

### **Opción 1: Docker Hub (Recomendado para Multi-PC)**

#### A. Subir Imagen a Docker Hub

```bash
# 1. Login en Docker Hub
docker login

# 2. Construir imagen con tu usuario
docker build -t tu-usuario/whatsapp-masivo:latest .

# 3. Subir a Docker Hub
docker push tu-usuario/whatsapp-masivo:latest
```

#### B. Descargar en Otra PC

```bash
# En otra PC (con Docker instalado):
docker pull tu-usuario/whatsapp-masivo:latest

# Crear docker-compose.yml (usar la imagen de Docker Hub)
# Cambiar en docker-compose.yml:
#   app:
#     image: tu-usuario/whatsapp-masivo:latest
#     # Comentar la línea "build: ."

# Iniciar
docker-compose up -d
```

---

### **Opción 2: GitHub + GitHub Actions (CI/CD Automático)**

#### A. Configurar GitHub Actions

Crear archivo `.github/workflows/docker-publish.yml`:

```yaml
name: Docker Build and Push

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Login to Docker Hub
      uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKERHUB_USERNAME }}
        password: ${{ secrets.DOCKERHUB_TOKEN }}
    
    - name: Build and push
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: tu-usuario/whatsapp-masivo:latest
```

#### B. Configurar Secrets en GitHub

1. Ir a tu repositorio → **Settings** → **Secrets and variables** → **Actions**
2. Agregar:
   - `DOCKERHUB_USERNAME`: tu usuario de Docker Hub
   - `DOCKERHUB_TOKEN`: tu token de Docker Hub

#### C. Desplegar desde Otra PC

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/expressDb.git
cd expressDb

# Configurar .env
cp .env.example .env
nano .env

# Descargar imagen automática de Docker Hub
docker-compose pull

# Iniciar
docker-compose up -d
```

---

### **Opción 3: Servidor Central (Producción)**

#### A. Configurar Servidor (Ubuntu/Debian)

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo apt install docker-compose

# Clonar proyecto
git clone https://github.com/tu-usuario/expressDb.git
cd expressDb

# Configurar .env
cp .env.example .env
nano .env

# Iniciar servicios
docker-compose up -d
```

#### B. Configurar Firewall

```bash
# Permitir puerto 3000 (App)
sudo ufw allow 3000/tcp

# Permitir MySQL (si quieres acceso externo)
sudo ufw allow 3306/tcp

# Habilitar firewall
sudo ufw enable
```

#### C. Configurar Dominio (Opcional)

Usar **Nginx** como proxy inverso:

```nginx
# /etc/nginx/sites-available/whatsapp-masivo
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/whatsapp-masivo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Instalar SSL con Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

---

## 🖥️ **Acceso desde Múltiples PCs**

### **Escenario: Jefe + Operadores**

#### **PC del Jefe (Escanea QR)**

1. Acceder a: `http://IP_SERVIDOR:3000`
2. Login con credenciales admin
3. Ir a **Dispositivos** → Crear nuevo dispositivo
4. Escanear QR con celular físico
5. ✅ Dispositivo conectado

#### **PC Operador 1 (Área BCP)**

1. Acceder a: `http://IP_SERVIDOR:3000`
2. Login con cuenta operador1 (crear desde admin)
3. Ver dispositivos ya conectados (compartidos)
4. Enviar mensajes desde sesión BCP
5. Ver chats y responder

#### **PC Operador 2 (Área Interbank)**

1. Acceder a: `http://IP_SERVIDOR:3000`
2. Login con cuenta operador2
3. Ver dispositivos compartidos
4. Enviar mensajes desde sesión Interbank
5. Ver chats y responder

### **Ventajas de Esta Arquitectura**

✅ Sesiones centralizadas (no se pierde conexión)
✅ Múltiples usuarios simultáneos
✅ Base de datos compartida
✅ Logs centralizados
✅ Backups automáticos
✅ Escalable horizontalmente

---

## 🔧 **Mantenimiento y Backups**

### **Backup Manual**

```bash
# Backup de MySQL
docker exec whatsapp_mysql mysqldump -u whatsapp_user -pwhatsapp_pass_2025 whatsapp_masivo > backup_$(date +%Y%m%d).sql

# Backup de volúmenes
docker run --rm -v whatsapp_sessions_shared:/source -v $(pwd):/backup alpine tar czf /backup/sessions_$(date +%Y%m%d).tar.gz -C /source .
```

### **Backup Automático con Cron**

```bash
# Editar crontab
crontab -e

# Agregar backup diario a las 3 AM
0 3 * * * cd /ruta/al/proyecto && docker exec whatsapp_mysql mysqldump -u whatsapp_user -pwhatsapp_pass_2025 whatsapp_masivo > backups/backup_$(date +\%Y\%m\%d).sql
```

### **Restaurar Backup**

```bash
# Restaurar MySQL
docker exec -i whatsapp_mysql mysql -u whatsapp_user -pwhatsapp_pass_2025 whatsapp_masivo < backup_20251030.sql

# Restaurar sesiones
docker run --rm -v whatsapp_sessions_shared:/target -v $(pwd):/backup alpine tar xzf /backup/sessions_20251030.tar.gz -C /target
```

### **Actualizar Sistema**

```bash
# Desde PC de desarrollo: hacer cambios y push
git add .
git commit -m "Mejoras X"
git push

# En servidor:
git pull
docker-compose build
docker-compose up -d
```

---

## 🔍 **Troubleshooting**

### **Problema: No puedo acceder desde otra PC**

```bash
# Verificar IP del servidor
hostname -I

# Verificar que el puerto esté abierto
sudo netstat -tulpn | grep 3000

# Verificar firewall
sudo ufw status
```

### **Problema: Sesiones de WhatsApp se pierden**

```bash
# Verificar volúmenes
docker volume ls | grep whatsapp_sessions

# Ver contenido del volumen
docker run --rm -v whatsapp_sessions_shared:/sessions alpine ls -la /sessions
```

### **Problema: Base de datos no inicia**

```bash
# Ver logs de MySQL
docker-compose logs mysql

# Verificar permisos del volumen
docker volume inspect whatsapp_mysql_data

# Recrear BD (CUIDADO: Borra datos)
docker-compose down -v
docker-compose up -d
```

### **Problema: Aplicación no responde**

```bash
# Reiniciar solo la app
docker-compose restart app

# Ver logs detallados
docker-compose logs --tail=100 -f app

# Reconstruir desde cero
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## 📊 **Monitoreo**

### **Ver Estado de Contenedores**

```bash
# Estado general
docker-compose ps

# Recursos usados
docker stats

# Logs en tiempo real
docker-compose logs -f
```

### **Healthchecks**

Verificar salud de servicios:

```bash
# Healthcheck de app
curl http://localhost:3000/health

# Healthcheck de MySQL
docker exec whatsapp_mysql mysqladmin ping

# Healthcheck de Redis
docker exec whatsapp_redis redis-cli ping
```

---

## 🎯 **Resumen de Comandos Principales**

```bash
# Iniciar todo
docker-compose up -d

# Detener todo
docker-compose down

# Ver logs
docker-compose logs -f app

# Reiniciar app
docker-compose restart app

# Reconstruir
docker-compose build
docker-compose up -d

# Backup
docker exec whatsapp_mysql mysqldump -u whatsapp_user -p whatsapp_masivo > backup.sql

# Limpiar todo (PELIGRO)
docker-compose down -v
```

---

## ✅ **Checklist de Despliegue**

- [ ] Docker y Docker Compose instalados
- [ ] Repositorio clonado
- [ ] `.env` configurado con contraseñas seguras
- [ ] Contenedores construidos (`docker-compose build`)
- [ ] Servicios iniciados (`docker-compose up -d`)
- [ ] Healthchecks pasando (`docker-compose ps`)
- [ ] Acceso al sistema (`http://localhost:3000`)
- [ ] Login exitoso
- [ ] Firewall configurado (si es servidor)
- [ ] Backups configurados

---

## 🎉 **¡Sistema Listo!**

Tu sistema ahora está completamente **dockerizado** y listo para:

✅ Acceso desde múltiples PCs
✅ Sesiones de WhatsApp compartidas
✅ Base de datos centralizada
✅ Escalabilidad horizontal
✅ Backups automáticos
✅ Despliegue rápido

**Próximos Pasos:**
1. Cambiar contraseñas por defecto
2. Crear usuarios operadores
3. Conectar dispositivos WhatsApp
4. Configurar backups automáticos
5. Monitorear logs regularmente

---

**📧 Soporte:** Ver README.md principal
**🔧 Actualizaciones:** `git pull && docker-compose up -d --build`

