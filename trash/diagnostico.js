console.log('=== DIAGNÓSTICO DEL SISTEMA ===\n');

// 1. Verificar .env
const fs = require('fs');
console.log('1. Archivo .env:', fs.existsSync('.env') ? '✅' : '❌');

// 2. Cargar dotenv
require('dotenv').config();
console.log('2. dotenv cargado: ✅');

// 3. Variables clave
console.log('\n3. Variables de entorno:');
console.log('   PORT:', process.env.PORT || '(no definido, usará 3000)');
console.log('   DB_HOST:', process.env.DB_HOST || '(no definido)');
console.log('   DB_NAME:', process.env.DB_NAME || '(no definido)');
console.log('   REDIS_HOST:', process.env.REDIS_HOST || '(no definido)');

// 4. Verificar estructura de archivos
console.log('\n4. Estructura de archivos:');
const files = [
    'src/backend/server.js',
    'src/config/database.js',
    'src/config/redis.js',
    'src/backend/routes/authRoutes.js',
    'src/backend/sockets/socketHandler.js'
];

files.forEach(file => {
    console.log(`   ${file}:`, fs.existsSync(file) ? '✅' : '❌');
});

// 5. Intentar conectar a MySQL
console.log('\n5. Probando MySQL...');
(async () => {
    try {
        const mysql = require('mysql2/promise');
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'whatsapp_masivo'
        });
        await conn.execute('SELECT 1');
        console.log('   MySQL: ✅');
        await conn.end();
    } catch (err) {
        console.log('   MySQL: ❌', err.message);
    }

    // 6. Intentar conectar a Redis
    console.log('\n6. Probando Redis...');
    try {
        const redis = require('redis');
        const client = redis.createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            }
        });
        
        await client.connect();
        await client.ping();
        console.log('   Redis: ✅');
        await client.quit();
    } catch (err) {
        console.log('   Redis: ❌', err.message);
    }

    // 7. Intentar cargar el servidor
    console.log('\n7. Intentando cargar servidor...');
    try {
        const express = require('express');
        const http = require('http');
        const app = express();
        const server = http.createServer(app);
        
        console.log('   Express: ✅');
        console.log('   HTTP Server: ✅');
        
        const io = require('socket.io')(server);
        console.log('   Socket.IO: ✅');
        
        console.log('\n✅ Todos los componentes básicos funcionan');
        console.log('\nAhora intenta: node src/backend/server.js');
        
    } catch (err) {
        console.log('   ❌ Error:', err.message);
        console.log(err.stack);
    }
})();

