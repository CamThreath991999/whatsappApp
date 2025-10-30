# ==================================
# Dockerfile para Sistema WhatsApp Masivo
# ==================================

FROM node:20-alpine

# Información del mantenedor
LABEL maintainer="Sistema WhatsApp Masivo"
LABEL description="Sistema de mensajería masiva WhatsApp con multi-dispositivo"

# Instalar dependencias del sistema
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    python3 \
    py3-pip \
    mysql-client

# Configurar Puppeteer para usar Chromium instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Crear directorio de aplicación
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm ci --omit=dev

# Copiar el resto del código
COPY . .

# Crear directorios necesarios
RUN mkdir -p uploads downloads chats sessions sessions_backup

# Exponer puertos
# 3000: Servidor principal
EXPOSE 3000

# Variables de entorno (se sobrescriben en docker-compose)
ENV NODE_ENV=production \
    PORT=3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando de inicio
CMD ["node", "src/backend/server.js"]

