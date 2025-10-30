const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

console.log('🧪 Probando whatsapp-web.js...\n');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'test-session',
        dataPath: './test-session-data'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

console.log('📱 Inicializando cliente WhatsApp...');

client.on('qr', async (qr) => {
    console.log('\n✅ QR GENERADO!');
    console.log('Texto del QR:', qr.substring(0, 50) + '...');
    
    try {
        const qrImage = await qrcode.toDataURL(qr);
        console.log('✅ QR convertido a imagen');
        console.log('Longitud de la imagen:', qrImage.length, 'caracteres');
        console.log('\n🎉 whatsapp-web.js funciona correctamente!');
        console.log('\nPresiona Ctrl+C para salir\n');
    } catch (error) {
        console.error('❌ Error convirtiendo QR:', error);
    }
});

client.on('ready', () => {
    console.log('✅ Cliente conectado!');
    process.exit(0);
});

client.on('authenticated', () => {
    console.log('✅ Autenticado!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación:', msg);
});

client.on('loading_screen', (percent) => {
    console.log('⏳ Cargando WhatsApp:', percent + '%');
});

client.initialize().catch(error => {
    console.error('❌ Error al inicializar:', error);
    process.exit(1);
});

// Timeout de 60 segundos
setTimeout(() => {
    console.log('\n⏱️ Timeout - 60 segundos alcanzados');
    console.log('Si no viste el QR, puede que Chromium no esté instalado');
    process.exit(1);
}, 60000);

