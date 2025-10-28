const cron = require('node-cron');
const { pool } = require('../../config/database');
const moment = require('moment');

class SchedulerService {
    constructor(campaignService) {
        this.campaignService = campaignService;
        this.tasks = new Map();
        this.startScheduler();
    }

    // Iniciar verificación periódica de campañas agendadas + tareas de mantenimiento
    startScheduler() {
        console.log('🕐 Iniciando sistema de cronjobs...\n');

        // 1. Verificar campañas agendadas (cada minuto)
        cron.schedule('* * * * *', async () => {
            await this.checkScheduledCampaigns();
        });
        console.log('   ✓ Cronjob: Verificación de campañas agendadas (cada minuto)');

        // 2. Verificar salud de dispositivos (cada 5 minutos)
        cron.schedule('*/5 * * * *', async () => {
            await this.checkDeviceHealth();
        });
        console.log('   ✓ Cronjob: Verificación de salud de dispositivos (cada 5 min)');

        // 3. Limpiar mensajes fallidos antiguos (cada hora)
        cron.schedule('0 * * * *', async () => {
            await this.cleanupOldFailedMessages();
        });
        console.log('   ✓ Cronjob: Limpieza de mensajes fallidos (cada hora)');

        // 4. Limpiar sesiones inactivas (cada 6 horas)
        cron.schedule('0 */6 * * *', async () => {
            await this.cleanupInactiveSessions();
        });
        console.log('   ✓ Cronjob: Limpieza de sesiones inactivas (cada 6 horas)');

        // 5. Reporte diario de estadísticas (a las 9:00 AM)
        cron.schedule('0 9 * * *', async () => {
            await this.generateDailyReport();
        });
        console.log('   ✓ Cronjob: Reporte diario de estadísticas (09:00 AM)');

        // 6. Mantenimiento de base de datos (domingos a las 3:00 AM)
        cron.schedule('0 3 * * 0', async () => {
            await this.performDatabaseMaintenance();
        });
        console.log('   ✓ Cronjob: Mantenimiento de BD (domingos 03:00 AM)\n');

        console.log('✅ Sistema de cronjobs iniciado correctamente');
    }

    // Verificar campañas agendadas
    async checkScheduledCampaigns() {
        try {
            const now = moment().format('YYYY-MM-DD HH:mm:00');

            // Buscar campañas agendadas para ejecutar
            const [campaigns] = await pool.execute(
                `SELECT * FROM campanas 
                 WHERE estado = 'agendada' 
                 AND fecha_agendada <= ?`,
                [now]
            );

            for (const campaign of campaigns) {
                console.log(`🕐 Ejecutando campaña agendada: ${campaign.nombre} (ID: ${campaign.id})`);
                
                try {
                    await this.campaignService.startCampaign(campaign.id);
                } catch (error) {
                    console.error(`Error ejecutando campaña ${campaign.id}:`, error);
                    
                    // Marcar como error
                    await pool.execute(
                        'UPDATE campanas SET estado = ? WHERE id = ?',
                        ['cancelada', campaign.id]
                    );
                }
            }

        } catch (error) {
            console.error('Error en verificación de agendamiento:', error);
        }
    }

    // Agendar campaña manualmente
    async scheduleCampaign(campaignId, scheduledDate) {
        try {
            const dateFormatted = moment(scheduledDate).format('YYYY-MM-DD HH:mm:ss');

            await pool.execute(
                'UPDATE campanas SET estado = ?, fecha_agendada = ? WHERE id = ?',
                ['agendada', dateFormatted, campaignId]
            );

            console.log(`✓ Campaña ${campaignId} agendada para ${dateFormatted}`);

            return {
                success: true,
                campaignId,
                scheduledDate: dateFormatted
            };

        } catch (error) {
            console.error('Error agendando campaña:', error);
            throw error;
        }
    }

    // Cancelar agendamiento
    async unscheduleCampaign(campaignId) {
        try {
            await pool.execute(
                'UPDATE campanas SET estado = ?, fecha_agendada = NULL WHERE id = ?',
                ['borrador', campaignId]
            );

            return { success: true };

        } catch (error) {
            console.error('Error cancelando agendamiento:', error);
            throw error;
        }
    }

    // Obtener campañas agendadas
    async getScheduledCampaigns(userId) {
        try {
            const [campaigns] = await pool.execute(
                `SELECT * FROM campanas 
                 WHERE usuario_id = ? AND estado = 'agendada'
                 ORDER BY fecha_agendada ASC`,
                [userId]
            );

            return campaigns;

        } catch (error) {
            console.error('Error obteniendo campañas agendadas:', error);
            throw error;
        }
    }

    // 🆕 NUEVAS TAREAS DE CRONJOB

    // Verificar salud de dispositivos
    async checkDeviceHealth() {
        try {
            // Buscar dispositivos que deberían estar conectados pero no responden
            const [devices] = await pool.execute(
                `SELECT * FROM dispositivos WHERE estado = 'conectado'`
            );

            console.log(`🏥 Verificando salud de ${devices.length} dispositivos...`);
            // Aquí podrías hacer ping o verificar estado real
        } catch (error) {
            console.error('Error verificando salud de dispositivos:', error);
        }
    }

    // Limpiar mensajes fallidos antiguos (más de 7 días)
    async cleanupOldFailedMessages() {
        try {
            const [result] = await pool.execute(
                `DELETE FROM mensajes 
                 WHERE estado = 'fallido' 
                 AND fecha_envio < DATE_SUB(NOW(), INTERVAL 7 DAY)`
            );

            if (result.affectedRows > 0) {
                console.log(`🗑️ Limpieza: ${result.affectedRows} mensajes fallidos eliminados`);
            }
        } catch (error) {
            console.error('Error limpiando mensajes:', error);
        }
    }

    // Limpiar sesiones inactivas
    async cleanupInactiveSessions() {
        try {
            const fs = require('fs');
            const path = require('path');
            const sessionsPath = path.join(__dirname, '../../../sessions');

            if (!fs.existsSync(sessionsPath)) return;

            console.log('🧹 Limpiando sesiones inactivas...');
            // Aquí podrías eliminar carpetas de sesiones viejas
            // Ejemplo: sesiones sin uso en 30 días
        } catch (error) {
            console.error('Error limpiando sesiones:', error);
        }
    }

    // Generar reporte diario
    async generateDailyReport() {
        try {
            const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');

            const [stats] = await pool.execute(
                `SELECT 
                    COUNT(DISTINCT campana_id) as total_campaigns,
                    COUNT(*) as total_messages,
                    SUM(CASE WHEN estado = 'enviado' THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN estado = 'fallido' THEN 1 ELSE 0 END) as failed
                 FROM mensajes 
                 WHERE DATE(fecha_envio) = ?`,
                [yesterday]
            );

            console.log(`\n📊 REPORTE DIARIO (${yesterday}):`);
            console.log(`   Campañas ejecutadas: ${stats[0].total_campaigns}`);
            console.log(`   Mensajes enviados: ${stats[0].sent}`);
            console.log(`   Mensajes fallidos: ${stats[0].failed}`);
            console.log(`   Tasa de éxito: ${((stats[0].sent / stats[0].total_messages) * 100).toFixed(2)}%\n`);
        } catch (error) {
            console.error('Error generando reporte:', error);
        }
    }

    // Mantenimiento de base de datos
    async performDatabaseMaintenance() {
        try {
            console.log('🔧 Ejecutando mantenimiento de base de datos...');

            // Optimizar tablas
            await pool.execute('OPTIMIZE TABLE mensajes');
            await pool.execute('OPTIMIZE TABLE campanas');
            await pool.execute('OPTIMIZE TABLE contactos');

            console.log('✅ Mantenimiento completado');
        } catch (error) {
            console.error('Error en mantenimiento:', error);
        }
    }
}

module.exports = SchedulerService;

