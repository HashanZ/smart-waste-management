"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MQTTService = void 0;
const Bin_1 = require("../models/Bin");
const socketService_1 = require("./socketService");
const logger_1 = require("../utils/logger");
class MQTTService {
    static async handleMessage(topic, data) {
        try {
            logger_1.logger.debug(`Received MQTT message on topic: ${topic}`, { data });
            const topicParts = topic.split('/');
            let binId;
            if (topicParts.length >= 3) {
                binId = topicParts[1];
            }
            else if (topicParts.length >= 4 && topicParts[1] === 'bins') {
                binId = topicParts[2];
            }
            if (!binId) {
                logger_1.logger.warn('No bin ID found in MQTT topic', { topic });
                return;
            }
            if (topic.includes('/data')) {
                await this.handleBinData(binId, data);
            }
            else if (topic.includes('/status')) {
                await this.handleBinStatus(binId, data);
            }
            else if (topic.includes('/alert')) {
                await this.handleAlert(binId, data);
            }
            else {
                logger_1.logger.warn('Unknown MQTT topic pattern', { topic });
            }
        }
        catch (error) {
            logger_1.logger.error('Error handling MQTT message:', error);
        }
    }
    static async handleBinData(binId, data) {
        try {
            const fillLevel = data.fillLevel ?? data.fillLevel;
            const batteryLevel = data.batteryLevel ?? data.batteryLevel;
            const signalStrength = data.signalStrength ?? data.signalStrength;
            if (typeof fillLevel !== 'number' || fillLevel < 0 || fillLevel > 100) {
                logger_1.logger.warn(`Invalid fill level for bin ${binId}`, { fillLevel });
                return;
            }
            const bin = await Bin_1.Bin.findOneAndUpdate({ binId }, {
                currentLevel: fillLevel,
                'metadata.batteryLevel': batteryLevel,
                'metadata.signalStrength': signalStrength,
                'metadata.lastDataReceived': new Date(),
                updatedAt: new Date()
            }, { new: true });
            if (!bin) {
                logger_1.logger.warn(`Bin ${binId} not found in database`);
                return;
            }
            if (bin.currentLevel >= 90 && !bin.isOverflowing) {
                bin.isOverflowing = true;
                bin.status = 'full';
                bin.alerts.push({
                    type: 'overflow',
                    message: `Bin ${binId} is ${bin.currentLevel}% full and requires immediate collection`,
                    timestamp: new Date(),
                    resolved: false
                });
                await bin.save();
                socketService_1.SocketService.emitAlert({
                    type: 'overflow',
                    binId: bin.binId,
                    level: bin.currentLevel,
                    location: bin.location,
                    timestamp: new Date(),
                    message: `Bin ${bin.binId} is overflowing at ${bin.currentLevel}%`
                });
                logger_1.logger.warn(`Bin overflow detected: ${binId}`, {
                    level: bin.currentLevel,
                    location: bin.location
                });
            }
            else if (bin.currentLevel < 85 && bin.isOverflowing) {
                bin.isOverflowing = false;
                if (bin.status === 'full') {
                    bin.status = 'active';
                }
                bin.alerts.forEach(alert => {
                    if (alert.type === 'overflow' && !alert.resolved) {
                        alert.resolved = true;
                    }
                });
                await bin.save();
                logger_1.logger.info(`Bin overflow resolved: ${binId}`, { level: bin.currentLevel });
            }
            if (batteryLevel && batteryLevel < 20) {
                const hasLowBatteryAlert = bin.alerts.some(alert => alert.type === 'maintenance' &&
                    alert.message.includes('battery') &&
                    !alert.resolved);
                if (!hasLowBatteryAlert) {
                    bin.alerts.push({
                        type: 'maintenance',
                        message: `Bin ${binId} has low battery: ${batteryLevel}%`,
                        timestamp: new Date(),
                        resolved: false
                    });
                    await bin.save();
                    socketService_1.SocketService.emitAlert({
                        type: 'maintenance',
                        binId: bin.binId,
                        batteryLevel: batteryLevel,
                        timestamp: new Date(),
                        message: `Bin ${bin.binId} requires battery maintenance`
                    });
                    logger_1.logger.warn(`Low battery detected for bin: ${binId}`, {
                        battery: batteryLevel
                    });
                }
            }
            if (signalStrength && signalStrength < 30) {
                const hasPoorSignalAlert = bin.alerts.some(alert => alert.type === 'offline' && !alert.resolved);
                if (!hasPoorSignalAlert) {
                    bin.alerts.push({
                        type: 'offline',
                        message: `Bin ${binId} has poor signal: ${signalStrength}%`,
                        timestamp: new Date(),
                        resolved: false
                    });
                    await bin.save();
                    logger_1.logger.warn(`Poor signal strength for bin: ${binId}`, {
                        signal: signalStrength
                    });
                }
            }
            socketService_1.SocketService.emitBinUpdate(bin);
            logger_1.logger.info(`Updated bin data for ${binId} via MQTT`, {
                fillLevel: bin.currentLevel,
                battery: bin.metadata.batteryLevel,
                signal: bin.metadata.signalStrength
            });
        }
        catch (error) {
            logger_1.logger.error(`Error handling bin data for ${binId}:`, error);
            throw error;
        }
    }
    static async handleBinStatus(binId, data) {
        try {
            const validStatuses = ['active', 'inactive', 'maintenance', 'full'];
            if (!validStatuses.includes(data.status)) {
                logger_1.logger.warn(`Invalid status for bin ${binId}`, { status: data.status });
                return;
            }
            const bin = await Bin_1.Bin.findOneAndUpdate({ binId }, {
                status: data.status,
                updatedAt: new Date()
            }, { new: true });
            if (bin) {
                socketService_1.SocketService.emitBinUpdate(bin);
                logger_1.logger.info(`Updated bin status for ${binId}`, {
                    status: data.status,
                    previousStatus: bin.status
                });
                if (data.status === 'maintenance') {
                    bin.alerts.push({
                        type: 'maintenance',
                        message: `Bin ${binId} is under maintenance`,
                        timestamp: new Date(),
                        resolved: false
                    });
                    await bin.save();
                    socketService_1.SocketService.emitAlert({
                        type: 'maintenance',
                        binId: bin.binId,
                        timestamp: new Date(),
                        message: `Bin ${bin.binId} is under maintenance`
                    });
                }
            }
            else {
                logger_1.logger.warn(`Bin ${binId} not found for status update`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error handling bin status for ${binId}:`, error);
        }
    }
    static async handleAlert(binId, data) {
        try {
            const validAlertTypes = ['full', 'overflow', 'maintenance', 'offline'];
            if (!validAlertTypes.includes(data.alertType)) {
                logger_1.logger.warn(`Invalid alert type for bin ${binId}`, { type: data.alertType });
                return;
            }
            const bin = await Bin_1.Bin.findOne({ binId });
            if (bin) {
                const hasUnresolvedAlert = bin.alerts.some(alert => alert.type === data.alertType && !alert.resolved);
                if (!hasUnresolvedAlert) {
                    bin.alerts.push({
                        type: data.alertType,
                        message: data.message,
                        timestamp: new Date(),
                        resolved: false
                    });
                    await bin.save();
                    socketService_1.SocketService.emitAlert({
                        type: data.alertType,
                        binId: bin.binId,
                        message: data.message,
                        severity: data.severity || 'medium',
                        location: bin.location,
                        timestamp: new Date()
                    });
                    logger_1.logger.warn(`Alert received for bin ${binId}`, {
                        type: data.alertType,
                        message: data.message,
                        severity: data.severity
                    });
                }
                else {
                    logger_1.logger.debug(`Duplicate alert ignored for bin ${binId}`, {
                        type: data.alertType
                    });
                }
            }
            else {
                logger_1.logger.warn(`Bin ${binId} not found for alert`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error handling alert for ${binId}:`, error);
        }
    }
    static async resolveAlert(binId, alertType) {
        try {
            const bin = await Bin_1.Bin.findOne({ binId });
            if (bin) {
                let resolved = false;
                bin.alerts.forEach(alert => {
                    if (alert.type === alertType && !alert.resolved) {
                        alert.resolved = true;
                        resolved = true;
                    }
                });
                if (resolved) {
                    await bin.save();
                    logger_1.logger.info(`Alert resolved for bin ${binId}`, { type: alertType });
                }
            }
        }
        catch (error) {
            logger_1.logger.error(`Error resolving alert for ${binId}:`, error);
        }
    }
    static async getUnresolvedAlertsCount() {
        try {
            const bins = await Bin_1.Bin.find({
                'alerts': {
                    $elemMatch: { resolved: false }
                }
            });
            let count = 0;
            bins.forEach(bin => {
                count += bin.alerts.filter(alert => !alert.resolved).length;
            });
            return count;
        }
        catch (error) {
            logger_1.logger.error('Error getting unresolved alerts count:', error);
            return 0;
        }
    }
}
exports.MQTTService = MQTTService;
//# sourceMappingURL=mqttService.js.map