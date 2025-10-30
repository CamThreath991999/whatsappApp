/**
 * Script para crear un archivo Excel de ejemplo con contactos
 */

const XLSX = require('xlsx');

// Datos de ejemplo
const data = [
    { categoria: 'BCP', telefono: '51900124654', nombre: 'Carlos Herrera', mensaje: 'Hola Carlos, tienes una deuda pendiente con BCP.' },
    { categoria: 'BCP', telefono: '51956469717', nombre: 'María Gonzales', mensaje: 'Hola María, te recordamos tu deuda con BCP.' },
    { categoria: 'INTERBANK', telefono: '51959021722', nombre: 'Juan Perez', mensaje: 'Hola Juan, tienes un pago pendiente en Interbank.' },
    { categoria: 'INTERBANK', telefono: '51912345678', nombre: 'Ana Torres', mensaje: 'Hola Ana, recordatorio de pago Interbank.' },
    { categoria: 'BBVA', telefono: '51987654321', nombre: 'Luis Ramirez', mensaje: 'Hola Luis, tu deuda con BBVA está pendiente.' },
    { categoria: 'BBVA', telefono: '51945678901', nombre: 'Sofia Mendoza', mensaje: 'Hola Sofia, recordatorio BBVA.' },
    { categoria: 'PICHINCHA', telefono: '51923456789', nombre: 'Roberto Silva', mensaje: 'Hola Roberto, deuda pendiente Pichincha.' },
    { categoria: 'FALABELLA', telefono: '51934567890', nombre: 'Patricia Lopez', mensaje: 'Hola Patricia, pago pendiente Falabella.' }
];

// Crear libro de Excel
const wb = XLSX.utils.book_new();

// Crear hoja con los datos
const ws = XLSX.utils.json_to_sheet(data);

// Agregar la hoja al libro
XLSX.utils.book_append_sheet(wb, ws, 'Contactos');

// Guardar archivo
XLSX.writeFile(wb, 'ejemplo_campana_masiva.xlsx');

console.log('✅ Archivo Excel creado: ejemplo_campana_masiva.xlsx');
console.log(`📊 ${data.length} contactos de ejemplo agregados`);
console.log('\nColumnas:');
console.log('- categoria: Categoría del contacto');
console.log('- telefono: Número de teléfono (incluye código de país)');
console.log('- nombre: Nombre completo');
console.log('- mensaje: Mensaje personalizado para cada contacto');

