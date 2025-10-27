const { redisHelper } = require('../../config/redis');

class AntiSpamService {
    constructor() {
        this.config = {
            minPauseBetweenMessages: 10000,      // 10 segundos
            maxPauseBetweenMessages: 30000,      // 30 segundos
            minPauseAfterBatch: 15000,           // 15 segundos
            maxPauseAfterBatch: 45000,           // 45 segundos
            minPauseBetweenLots: 30000,          // 30 segundos
            maxPauseBetweenLots: 200000,         // 200 segundos (3.3 minutos)
            minMessagesPerBatch: 1,
            maxMessagesPerBatch: 3,              // Reducido de 5 a 3 para ser más cauteloso
            lotRanges: [
                { min: 1, max: 5 },              // Reducido para ser más cauteloso
                { min: 5, max: 10 },
                { min: 10, max: 15 },
                { min: 15, max: 20 },
                { min: 20, max: 25 }
            ]
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

    // Generar plan de envío con rotación de dispositivos
    generateSendingPlan(campaignMessages, devices) {
        const plan = [];
        
        // Agrupar mensajes por categoría/dispositivo
        const messagesByDevice = {};
        devices.forEach(device => {
            messagesByDevice[device.id] = campaignMessages.filter(
                msg => msg.dispositivo_id === device.id
            );
        });

        // Calcular estructura de lotes para cada dispositivo
        const deviceStructures = {};
        Object.keys(messagesByDevice).forEach(deviceId => {
            const messages = messagesByDevice[deviceId];
            if (messages.length > 0) {
                deviceStructures[deviceId] = {
                    messages,
                    structure: this.calculateBatchStructure(messages.length),
                    currentIndex: 0
                };
            }
        });

        // Generar plan de envío alternando dispositivos
        const activeDevices = Object.keys(deviceStructures);
        let totalSent = 0;
        const totalMessages = campaignMessages.length;
        let lotCounter = 0;
        let messagesInCurrentLot = 0;

        while (totalSent < totalMessages && activeDevices.length > 0) {
            // Seleccionar dispositivo aleatorio
            const randomDeviceIndex = this.randomInRange(0, activeDevices.length - 1);
            const deviceId = activeDevices[randomDeviceIndex];
            const deviceData = deviceStructures[deviceId];

            if (deviceData.currentIndex >= deviceData.messages.length) {
                // Este dispositivo ya terminó sus mensajes
                activeDevices.splice(randomDeviceIndex, 1);
                continue;
            }

            // Obtener siguiente batch
            const currentLotIndex = Math.floor(
                deviceData.currentIndex / deviceData.structure.reduce(
                    (sum, lot) => sum + lot.totalInLot, 0
                ) * deviceData.structure.length
            );
            
            const batchSize = this.randomInRange(
                this.config.minMessagesPerBatch,
                this.config.maxMessagesPerBatch
            );

            const messagesToSend = deviceData.messages.slice(
                deviceData.currentIndex,
                deviceData.currentIndex + batchSize
            );

            if (messagesToSend.length > 0) {
                plan.push({
                    deviceId,
                    messages: messagesToSend,
                    pauseBefore: this.randomInRange(
                        this.config.minPauseBetweenMessages,
                        this.config.maxPauseBetweenMessages
                    ),
                    pauseAfter: this.randomInRange(
                        this.config.minPauseAfterBatch,
                        this.config.maxPauseAfterBatch
                    )
                });

                deviceData.currentIndex += messagesToSend.length;
                totalSent += messagesToSend.length;
                messagesInCurrentLot += messagesToSend.length;

                // Verificar si completamos un lote (cada 50 mensajes)
                if (messagesInCurrentLot >= 50) {
                    lotCounter++;
                    messagesInCurrentLot = 0;
                    
                    // Agregar pausa larga entre lotes
                    plan.push({
                        type: 'lot_pause',
                        duration: this.randomInRange(
                            this.config.minPauseBetweenLots,
                            this.config.maxPauseBetweenLots
                        ),
                        lotNumber: lotCounter
                    });
                }
            }
        }

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

