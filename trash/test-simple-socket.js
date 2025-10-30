/**
 * Test SUPER SIMPLE de Socket.IO
 */

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Servir archivo HTML de test
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Test Socket.IO Simple</title>
</head>
<body>
    <h1>Test Socket.IO</h1>
    <button onclick="testEvent()">Enviar Evento</button>
    <div id="logs"></div>
    
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const logs = document.getElementById('logs');
        function log(msg) {
            logs.innerHTML += '<p>' + msg + '</p>';
            console.log(msg);
        }
        
        const socket = io();
        
        socket.on('connect', () => {
            log('✅ Conectado - ID: ' + socket.id);
        });
        
        socket.on('test-response', (data) => {
            log('✅ Respuesta recibida: ' + data.message);
        });
        
        function testEvent() {
            log('📤 Enviando evento test-event...');
            socket.emit('test-event', { message: 'Hola desde el cliente' });
        }
    </script>
</body>
</html>
    `);
});

// Socket.IO handlers
io.on('connection', (socket) => {
    console.log('✅ Cliente conectado:', socket.id);
    
    socket.on('test-event', (data) => {
        console.log('📥 Evento recibido del cliente:', data);
        socket.emit('test-response', { message: 'Evento recibido correctamente!' });
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`\n✅ Servidor de test corriendo en http://localhost:${PORT}`);
    console.log('Abre esta URL en tu navegador y haz click en el botón\n');
});

