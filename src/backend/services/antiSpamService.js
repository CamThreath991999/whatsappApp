const { redisHelper } = require('../../config/redis');

class AntiSpamService {
    constructor() {
        this.config = {
            // Pausas MÁS LARGAS para evitar bloqueo
            minPauseBetweenMessages: 15000,      // 15 segundos (aumentado de 10)
            maxPauseBetweenMessages: 45000,      // 45 segundos (aumentado de 30)
            minPauseAfterBatch: 30000,           // 30 segundos (aumentado de 15)
            maxPauseAfterBatch: 90000,           // 90 segundos / 1.5 min (aumentado de 45)
            minPauseBetweenLots: 120000,         // 2 minutos (aumentado de 30s)
            maxPauseBetweenLots: 300000,         // 5 minutos (aumentado de 3.3 min)
            minMessagesPerBatch: 1,
            maxMessagesPerBatch: 2,              // REDUCIDO a 2 (antes 3) - MÁS SEGURO
            lotRanges: [
                { min: 1, max: 3 },              // Mini lotes: 1-3 mensajes
                { min: 3, max: 7 },              // Pequeños: 3-7 mensajes
                { min: 7, max: 12 },             // Medianos: 7-12 mensajes
                { min: 12, max: 18 },            // Grandes: 12-18 mensajes
                { min: 18, max: 25 }             // Muy grandes: 18-25 mensajes
            ],
            // Límites de seguridad
            maxMessagesPerDevice: 50,            // Máximo 50 mensajes por dispositivo antes de cambiar
            maxMessagesBeforeHumanBehavior: 10,  // Cada 10 mensajes ejecutar comportamiento humano
            humanBehaviorProbability: 0.8        // 80% probabilidad de comportamiento humano
        };
    }

    // Generar número aleatorio en rango usando distribución gaussiana
    gaussianRandom(min, max, skew = 1) {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        
        let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        
        num = num / 10.0 + 0.5;
        if (num > 1 || num < 0) {
            return this.gaussianRandom(min, max, skew);
        }
        
        num = Math.pow(num, skew);
        num *= max - min;
        num += min;
        
        return Math.round(num);
    }

    // Generar número aleatorio simple
    randomInRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Calcular estructura de lotes para una campaña
    calculateBatchStructure(totalMessages) {
        const structure = [];
        let remaining = totalMessages;
        let currentRangeIndex = 0;

        while (remaining > 0 && currentRangeIndex < this.config.lotRanges.length) {
            const range = this.config.lotRanges[currentRangeIndex];
            
            // Decidir cuántos lotes en este rango (aleatorio)
            const numLots = this.randomInRange(1, 5);
            
            for (let i = 0; i < numLots && remaining > 0; i++) {
                // Tamaño del lote (con gaussiana para ser impredecible)
                const lotSize = Math.min(
                    this.gaussianRandom(range.min, range.max),
                    remaining
                );
                
                // Dividir lote en batches pequeños (1-5 mensajes)
                const batches = [];
                let lotRemaining = lotSize;
                
                while (lotRemaining > 0) {
                    const batchSize = Math.min(
                        this.randomInRange(
                            this.config.minMessagesPerBatch,
                            this.config.maxMessagesPerBatch
                        ),
                        lotRemaining
                    );
                    
                    batches.push({
                        size: batchSize,
                        pause: this.randomInRange(
                            this.config.minPauseBetweenMessages,
                            this.config.maxPauseBetweenMessages
                        )
                    });
                    
                    lotRemaining -= batchSize;
                }
                
                structure.push({
                    lotNumber: structure.length + 1,
                    range: `${range.min}-${range.max}`,
                    totalInLot: lotSize,
                    batches,
                    pauseAfterLot: this.randomInRange(
                        this.config.minPauseBetweenLots,
                        this.config.maxPauseBetweenLots
                    )
                });
                
                remaining -= lotSize;
            }
            
            currentRangeIndex++;
        }

        // Si todavía quedan mensajes, crear un último lote
        if (remaining > 0) {
            const batches = [];
            while (remaining > 0) {
                const batchSize = Math.min(
                    this.randomInRange(
                        this.config.minMessagesPerBatch,
                        this.config.maxMessagesPerBatch
                    ),
                    remaining
                );
                
                batches.push({
                    size: batchSize,
                    pause: this.randomInRange(
                        this.config.minPauseBetweenMessages,
                        this.config.maxPauseBetweenMessages
                    )
                });
                
                remaining -= batchSize;
            }
            
            structure.push({
                lotNumber: structure.length + 1,
                range: 'final',
                totalInLot: batches.reduce((sum, b) => sum + b.size, 0),
                batches,
                pauseAfterLot: 0
            });
        }

        return structure;
    }

    // Generar plan de envío con rotación MEJORADA de dispositivos
    generateSendingPlan(campaignMessages, devices) {
        const plan = [];
        
        console.log(`\n🎯 === GENERANDO PLAN DE ENVÍO ===`);
        console.log(`   📊 Total mensajes: ${campaignMessages.length}`);
        console.log(`   📱 Total dispositivos: ${devices.length}`);
        
        // **AJUSTE DINÁMICO SEGÚN DISPOSITIVOS**
        const isSingleDevice = devices.length === 1;
        const deviceMultiplier = Math.min(devices.length, 5); // Max 5 dispositivos
        
        if (isSingleDevice) {
            console.log(`   ⚠️ MODO ULTRA-SEGURO: Solo 1 dispositivo - Pausas MÁS LARGAS`);
            // Aumentar pausas en 50% para 1 solo dispositivo
            this.config.minPauseBetweenMessages *= 1.5;
            this.config.maxPauseBetweenMessages *= 1.5;
            this.config.minPauseAfterBatch *= 1.5;
            this.config.maxPauseAfterBatch *= 1.5;
            this.config.maxMessagesPerBatch = 1; // Solo 1 mensaje por vez
        } else {
            console.log(`   🔄 MODO ROTACIÓN: ${devices.length} dispositivos - Pausas optimizadas`);
            // Con múltiples dispositivos, pausas pueden ser un poco más cortas
            const reduction = Math.min(0.8 + (deviceMultiplier * 0.05), 1.0);
            this.config.minPauseBetweenMessages = Math.floor(15000 * reduction);
            this.config.maxPauseBetweenMessages = Math.floor(45000 * reduction);
        }
        
        // Agrupar mensajes por dispositivo
        const messagesByDevice = {};
        devices.forEach(device => {
            messagesByDevice[device.id] = campaignMessages.filter(
                msg => msg.dispositivo_id === device.id
            );
            console.log(`   📱 Dispositivo ${device.id}: ${messagesByDevice[device.id].length} mensajes`);
        });

        // Estructuras para tracking
        const deviceStructures = {};
        Object.keys(messagesByDevice).forEach(deviceId => {
            const messages = messagesByDevice[deviceId];
            if (messages.length > 0) {
                deviceStructures[deviceId] = {
                    messages,
                    currentIndex: 0,
                    messagesSentInSession: 0
                };
            }
        });

        // Generar plan con ROTACIÓN ALEATORIA
        const activeDevices = Object.keys(deviceStructures);
        let totalSent = 0;
        const totalMessages = campaignMessages.length;
        let lotCounter = 0;
        let messagesInCurrentLot = 0;
        let stepCounter = 0;

        while (totalSent < totalMessages && activeDevices.length > 0) {
            // **ROTACIÓN ALEATORIA** - Seleccionar dispositivo random
            const randomDeviceIndex = this.randomInRange(0, activeDevices.length - 1);
            const deviceId = activeDevices[randomDeviceIndex];
            const deviceData = deviceStructures[deviceId];

            // Si este dispositivo terminó sus mensajes, removerlo
            if (deviceData.currentIndex >= deviceData.messages.length) {
                console.log(`   ✅ Dispositivo ${deviceId} completó todos sus mensajes`);
                activeDevices.splice(randomDeviceIndex, 1);
                continue;
            }

            // Tamaño de batch ALEATORIO (1-2 mensajes)
            const batchSize = this.randomInRange(
                this.config.minMessagesPerBatch,
                this.config.maxMessagesPerBatch
            );

            const messagesToSend = deviceData.messages.slice(
                deviceData.currentIndex,
                deviceData.currentIndex + batchSize
            );

            if (messagesToSend.length > 0) {
                stepCounter++;
                
                plan.push({
                    type: 'send_batch',
                    deviceId: parseInt(deviceId),
                    messages: messagesToSend,
                    pauseBefore: this.gaussianRandom(
                        this.config.minPauseBetweenMessages,
                        this.config.maxPauseBetweenMessages
                    ),
                    pauseAfter: this.gaussianRandom(
                        this.config.minPauseAfterBatch,
                        this.config.maxPauseAfterBatch
                    ),
                    stepNumber: stepCounter
                });

                deviceData.currentIndex += messagesToSend.length;
                deviceData.messagesSentInSession += messagesToSend.length;
                totalSent += messagesToSend.length;
                messagesInCurrentLot += messagesToSend.length;

                console.log(`   🔄 Paso ${stepCounter}: Dispositivo ${deviceId} enviará ${messagesToSend.length} mensaje(s) [${totalSent}/${totalMessages}]`);

                // **PAUSA DE LOTE** cada 30-50 mensajes (aleatorio)
                const lotThreshold = this.randomInRange(30, 50);
                if (messagesInCurrentLot >= lotThreshold) {
                    lotCounter++;
                    messagesInCurrentLot = 0;
                    
                    const lotPause = this.gaussianRandom(
                        this.config.minPauseBetweenLots,
                        this.config.maxPauseBetweenLots
                    );
                    
                    plan.push({
                        type: 'lot_pause',
                        duration: lotPause,
                        lotNumber: lotCounter
                    });
                    
                    console.log(`   ⏸️ PAUSA DE LOTE ${lotCounter}: ${Math.floor(lotPause / 1000)}s`);
                }

                // **COMPORTAMIENTO HUMANO** cada 10-15 mensajes
                if (totalSent % this.randomInRange(10, 15) === 0) {
                    plan.push({
                        type: 'human_behavior',
                        deviceId: parseInt(deviceId),
                        probability: this.config.humanBehaviorProbability
                    });
                    console.log(`   🤖 Comportamiento humano programado`);
                }
            }
        }

        console.log(`   ✅ Plan generado: ${plan.length} pasos, ${lotCounter} lotes`);
        console.log(`🎯 === FIN PLAN DE ENVÍO ===\n`);

        return plan;
    }

    // Dormir/pausar
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Generar pausa aleatoria
    getRandomPause(min, max) {
        return this.randomInRange(min, max);
    }

    // Guardar progreso de campaña en Redis
    async saveCampaignProgress(campaignId, progress) {
        try {
            await redisHelper.setCache(
                `campaign:progress:${campaignId}`,
                progress,
                86400 // 24 horas
            );
        } catch (error) {
            console.error('Error guardando progreso:', error);
        }
    }

    // Obtener progreso de campaña
    async getCampaignProgress(campaignId) {
        try {
            return await redisHelper.getCache(`campaign:progress:${campaignId}`);
        } catch (error) {
            console.error('Error obteniendo progreso:', error);
            return null;
        }
    }

    // Generar reporte de estructura
    generateStructureReport(structure) {
        const report = {
            totalLots: structure.length,
            totalMessages: structure.reduce((sum, lot) => sum + lot.totalInLot, 0),
            estimatedTime: 0,
            lots: []
        };

        structure.forEach(lot => {
            const lotTime = lot.batches.reduce((sum, batch) => {
                return sum + batch.pause;
            }, 0) + lot.pauseAfterLot;

            report.estimatedTime += lotTime;
            report.lots.push({
                lotNumber: lot.lotNumber,
                range: lot.range,
                messages: lot.totalInLot,
                batches: lot.batches.length,
                estimatedTime: lotTime
            });
        });

        // Convertir tiempo estimado a formato legible
        report.estimatedTimeFormatted = this.formatDuration(report.estimatedTime);

        return report;
    }

    // Formatear duración
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

module.exports = AntiSpamService;
