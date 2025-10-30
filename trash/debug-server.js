/**
 * Servidor con MÁXIMOS logs para debug
 */

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware básico
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src/frontend')));

console.log('🚀 Iniciando servidor de debug...\n');

// Socket.IO con logs detallados
io.on('connection', (socket) => {
    console.log('\n🟢 ============ NUEVO CLIENTE ============');
    console.log('Socket ID:', socket.id);
    console.log('Timestamp:', new Date().toISOString());
    console.log('=========================================\n');
    
    // Escuchar CUALQUIER evento
    socket.onAny((eventName, ...args) => {
        console.log('\n📥 EVENTO RECIBIDO:');
        console.log('   Nombre:', eventName);
        console.log('   Datos:', JSON.stringify(args, null, 2));
        console.log('   Socket ID:', socket.id);
        console.log('   Timestamp:', new Date().toISOString());
        console.log('');
    });
    
    // Evento específico create-session
    socket.on('create-session', async (data) => {
        console.log('\n🎯 ============ CREATE-SESSION ============');
        console.log('Datos recibidos:', JSON.stringify(data, null, 2));
        console.log('==========================================\n');
        
        // Responder inmediatamente
        socket.emit('session-created', {
            success: true,
            sessionId: data.sessionId,
            message: 'Sesión recibida en el servidor'
        });
        
        console.log('✅ Respuesta enviada al cliente');
        
        // Simular generación de QR (después de 2 segundos)
        setTimeout(() => {
            console.log('\n🎯 Simulando QR generado...');
            const fakeQR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            
            socket.emit(`qr-${data.sessionId}`, {
                sessionId: data.sessionId,
                qr: fakeQR
            });
            
            console.log(`✅ QR emitido: qr-${data.sessionId}`);
        }, 2000);
    });
    
    socket.on('disconnect', (reason) => {
        console.log('\n🔴 Cliente desconectado');
        console.log('   Socket ID:', socket.id);
        console.log('   Razón:', reason);
        console.log('');
    });
});

// Ruta de health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', socketConnections: io.engine.clientsCount });
});

// Iniciar servidor
const PORT = 3002;
server.listen(PORT, () => {
    console.log(`\n✅ Servidor de DEBUG corriendo en puerto ${PORT}`);
    console.log(`   URL: http://localhost:${PORT}`);
    console.log(`   Clientes conectados: ${io.engine.clientsCount}\n`);
    console.log('👉 Abre http://localhost:3002 y prueba conectar un dispositivo\n');
});

// Log cada 5 segundos de clientes conectados
setInterval(() => {
    const count = io.engine.clientsCount;
    if (count > 0) {
        console.log(`📊 Clientes conectados: ${count}`);
    }
}, 5000);

