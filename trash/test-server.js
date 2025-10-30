const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
    res.send('✅ Servidor funcionando!');
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

app.listen(PORT, () => {
    console.log(`✅ Servidor de prueba corriendo en http://localhost:${PORT}`);
    console.log(`   Presiona Ctrl+C para detener`);
});

