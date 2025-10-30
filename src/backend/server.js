const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('../config/database');
const { connectRedis } = require('../config/redis');

//PORT
// Importar rutas
const authRoutes = require('./routes/authRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const contactRoutes = require('./routes/contactRoutes');
const chatRoutes = require('./routes/chatRoutes');
const notesRoutes = require('./routes/notesRoutes');
const categoryDeviceRoutes = require('./routes/categoryDeviceRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

// Importar socket handlers
const { initializeSocketHandlers } = require('./sockets/socketHandler');

// Inicializar app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Cambiar a true en producción con HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
app.use('/downloads', express.static(path.join(__dirname, '../../downloads')));

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/category-devices', categoryDeviceRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/upload', require('./routes/uploadRoutes'));

// Health check para Docker
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: true,
        message: err.message || 'Error interno del servidor'
    });
});

// Puerto
const PORT = process.env.PORT || 3000;

// Iniciar servidor
async function startServer() {
    try {
        console.log('🚀 Iniciando servidor...\n');

        // Conectar a base de datos
        const dbConnected = await testConnection();
        if (!dbConnected) {
            console.warn('⚠ Base de datos no disponible. Algunas funciones pueden no funcionar.');
        }

        // Conectar a Redis
        const redisConnected = await connectRedis();
        if (!redisConnected) {
            console.warn('⚠ Redis no disponible. El sistema funcionará sin caché.');
        }

        // Inicializar Socket.IO ANTES de iniciar el servidor
        console.log('🔌 Inicializando Socket.IO...');
        const { whatsappService, campaignService } = initializeSocketHandlers(io);
        
        // Hacer io y servicios disponibles globalmente
        app.set('io', io);
        app.set('whatsappService', whatsappService);
        app.set('campaignService', campaignService);
        console.log('✓ Socket.IO configurado\n');
        
        // Iniciar servidor HTTP
        server.listen(PORT, () => {
            console.log(`\n✓ Servidor escuchando en puerto ${PORT}`);
            console.log(`✓ URL: http://localhost:${PORT}`);
            console.log(`✓ Socket.IO activo - Clientes: ${io.engine.clientsCount}`);
            console.log('📱 Sistema de WhatsApp Masivo listo\n');
        });

    } catch (error) {
        console.error('✗ Error al iniciar servidor:', error);
        process.exit(1);
    }
}

// Manejo de cierre graceful
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Cerrando servidor...');
    server.close(() => {
        console.log('✓ Servidor cerrado');
        process.exit(0);
    });
});

// Iniciar
startServer();

module.exports = { app, io };

