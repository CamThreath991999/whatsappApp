/**
 * Script para aplicar migraciones de base de datos
 * Ejecutar: node scripts/apply_migrations.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigrations() {
    let connection;
    
    try {
        console.log('🔧 Conectando a la base de datos...');
        
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'whatsapp_masivo',
            multipleStatements: true
        });

        console.log('✅ Conexión establecida');

        // Migración 1: Agregar campo observacion
        console.log('\n📝 Aplicando migración: observacion...');
        try {
            await connection.execute(`
                ALTER TABLE mensajes 
                ADD COLUMN IF NOT EXISTS observacion VARCHAR(255) AFTER error_mensaje
            `);
            console.log('✅ Campo "observacion" agregado/verificado');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️  Campo "observacion" ya existe');
            } else {
                console.error('❌ Error agregando campo "observacion":', error.message);
            }
        }

        // Migración 2: Agregar campo metadata
        console.log('\n📝 Aplicando migración: metadata...');
        try {
            await connection.execute(`
                ALTER TABLE mensajes 
                ADD COLUMN IF NOT EXISTS metadata JSON AFTER observacion
            `);
            console.log('✅ Campo "metadata" agregado/verificado');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️  Campo "metadata" ya existe');
            } else {
                console.error('❌ Error agregando campo "metadata":', error.message);
            }
        }

        // Verificar estructura final
        console.log('\n🔍 Verificando estructura de tabla "mensajes"...');
        const [columns] = await connection.execute(`
            DESCRIBE mensajes
        `);

        const hasObservacion = columns.some(col => col.Field === 'observacion');
        const hasMetadata = columns.some(col => col.Field === 'metadata');

        console.log('\n📊 Estado de migraciones:');
        console.log(`   ${hasObservacion ? '✅' : '❌'} Campo "observacion"`);
        console.log(`   ${hasMetadata ? '✅' : '❌'} Campo "metadata"`);

        if (hasObservacion && hasMetadata) {
            console.log('\n🎉 ¡Todas las migraciones aplicadas exitosamente!');
        } else {
            console.log('\n⚠️  Algunas migraciones no se aplicaron correctamente.');
            console.log('   Por favor, ejecuta los scripts SQL manualmente:');
            console.log('   - database/migration_observacion.sql');
            console.log('   - database/migration_metadata.sql');
        }

    } catch (error) {
        console.error('\n❌ Error general:', error.message);
        console.error('\nDetalles del error:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n👋 Conexión cerrada');
        }
    }
}

// Ejecutar
console.log('═══════════════════════════════════════════════');
console.log('  🚀 APLICADOR DE MIGRACIONES - WhatsApp Masivo');
console.log('═══════════════════════════════════════════════\n');

applyMigrations()
    .then(() => {
        console.log('\n✅ Proceso completado');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    });

