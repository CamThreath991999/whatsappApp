// check_qr.js
// Script simple para comprobar en Redis si existe el QR para una session
const { connectRedis, redisHelper } = require('./src/config/redis');

async function main() {
    const session = process.argv[2];
    if (!session) {
        console.error('Uso: node check_qr.js <sessionId>');
        process.exit(1);
    }

    const ok = await connectRedis();
    if (!ok) {
        console.error('No se pudo conectar a Redis');
        process.exit(1);
    }

    const key = `qr:${session}`;
    const res = await redisHelper.getCache(key);
    if (!res) {
        console.log('QR no encontrado en Redis para session:', session);
        process.exit(0);
    }

    console.log('QR encontrado para session:', session);
    console.log('Longitud del QR (base64):', res.length);
    // Opcional: no imprimir el data URL completo porque es largo
    console.log('Primeros 200 caracteres:\n', res.substring(0,200));
    process.exit(0);
}

main().catch(err => {
    console.error('Error en check_qr:', err);
    process.exit(1);
});