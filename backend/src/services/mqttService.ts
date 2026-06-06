import { Bin } from '@/models/Bin';
import { SocketService } from './socketService';
import { logger } from '@/utils/logger';

interface SensorData {
  fillLevel: number;
  batteryLevel?: number;
  signalStrength?: number;
  timestamp: Date | string;
}

interface BinStatusData {
  status: 'active' | 'inactive' | 'maintenance' | 'full';
  timestamp: Date | string;
}

interface AlertData {
  alertType: 'full' | 'overflow' | 'maintenance' | 'offline';
  message: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date | string;
}

export class MQTTService {
  /**
   * Main message handler for MQTT messages
   */
  static async handleMessage(topic: string, data: any): Promise<void> {
    try {
      logger.debug(`Received MQTT message on topic: ${topic}`, { data });

      // Parse topic: smartwaste/{binId}/data or smartwaste/BIN001/data
      const topicParts = topic.split('/');
      let binId: string | undefined;

      // Handle both formats: smartwaste/bins/{binId}/... or smartwaste/{binId}/...
      if (topicParts.length >= 3) {
        // Format: smartwaste/{binId}/data
        binId = topicParts[1];
      } else if (topicParts.length >= 4 && topicParts[1] === 'bins') {
        // Format: smartwaste/bins/{binId}/data
        binId = topicParts[2];
      }

      if (!binId) {
        logger.warn('No bin ID found in MQTT topic', { topic });
        return;
      }

      // Route to appropriate handler based on topic
      if (topic.includes('/data')) {
        await this.handleBinData(binId, data);
      } else if (topic.includes('/status')) {
        await this.handleBinStatus(binId, data);
      } else if (topic.includes('/alert')) {
        await this.handleAlert(binId, data);
      } else {
        logger.warn('Unknown MQTT topic pattern', { topic });
      }
    } catch (error) {
      logger.error('Error handling MQTT message:', error);
    }
  }

  /**
   * Handle bin sensor data updates
   */
  static async handleBinData(binId: string, data: SensorData): Promise<void> {
    try {
      // Handle both formats: {fillLevel, ...} or {binId, fillLevel, ...}
      const fillLevel = data.fillLevel ?? (data as any).fillLevel;
      const batteryLevel = data.batteryLevel ?? (data as any).batteryLevel;
      const signalStrength = data.signalStrength ?? (data as any).signalStrength;

      // Validate incoming data
      if (typeof fillLevel !== 'number' || fillLevel < 0 || fillLevel > 100) {
        logger.warn(`Invalid fill level for bin ${binId}`, { fillLevel });
        return;
      }

      // Update bin in database
      const bin = await Bin.findOneAndUpdate(
        { binId },
        {
          currentLevel: fillLevel,
          'metadata.batteryLevel': batteryLevel,
          'metadata.signalStrength': signalStrength,
          'metadata.lastDataReceived': new Date(),
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!bin) {
        logger.warn(`Bin ${binId} not found in database`);
        return;
      }

      // Check for overflow condition
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

        // Emit overflow alert
        SocketService.emitAlert({
          type: 'overflow',
          binId: bin.binId,
          level: bin.currentLevel,
          location: bin.location,
          timestamp: new Date(),
          message: `Bin ${bin.binId} is overflowing at ${bin.currentLevel}%`
        });

        logger.warn(`Bin overflow detected: ${binId}`, {
          level: bin.currentLevel,
          location: bin.location
        });
      } else if (bin.currentLevel < 85 && bin.isOverflowing) {
        // Reset overflow status if level drops below threshold
        bin.isOverflowing = false;
        if (bin.status === 'full') {
          bin.status = 'active';
        }

        // Resolve overflow alerts
        bin.alerts.forEach(alert => {
          if (alert.type === 'overflow' && !alert.resolved) {
            alert.resolved = true;
          }
        });

        await bin.save();

        logger.info(`Bin overflow resolved: ${binId}`, { level: bin.currentLevel });
      }

      // Check for low battery condition
      if (batteryLevel && batteryLevel < 20) {
        const hasLowBatteryAlert = bin.alerts.some(
          alert => alert.type === 'maintenance' &&
                   alert.message.includes('battery') &&
                   !alert.resolved
        );

        if (!hasLowBatteryAlert) {
          bin.alerts.push({
            type: 'maintenance',
            message: `Bin ${binId} has low battery: ${batteryLevel}%`,
            timestamp: new Date(),
            resolved: false
          });
          await bin.save();

          // Emit maintenance alert
          SocketService.emitAlert({
            type: 'maintenance',
            binId: bin.binId,
            batteryLevel: batteryLevel,
            timestamp: new Date(),
            message: `Bin ${bin.binId} requires battery maintenance`
          });

          logger.warn(`Low battery detected for bin: ${binId}`, {
            battery: batteryLevel
          });
        }
      }

      // Check for poor signal strength
      if (signalStrength && signalStrength < 30) {
        const hasPoorSignalAlert = bin.alerts.some(
          alert => alert.type === 'offline' && !alert.resolved
        );

        if (!hasPoorSignalAlert) {
          bin.alerts.push({
            type: 'offline',
            message: `Bin ${binId} has poor signal: ${signalStrength}%`,
            timestamp: new Date(),
            resolved: false
          });
          await bin.save();

          logger.warn(`Poor signal strength for bin: ${binId}`, {
            signal: signalStrength
          });
        }
      }

      // Emit real-time update via Socket.io
      SocketService.emitBinUpdate(bin);

      logger.info(`Updated bin data for ${binId} via MQTT`, {
        fillLevel: bin.currentLevel,
        battery: bin.metadata.batteryLevel,
        signal: bin.metadata.signalStrength
      });

    } catch (error) {
      logger.error(`Error handling bin data for ${binId}:`, error);
      throw error;
    }
  }

  /**
   * Handle bin status updates
   */
  static async handleBinStatus(binId: string, data: BinStatusData): Promise<void> {
    try {
      // Validate status value
      const validStatuses = ['active', 'inactive', 'maintenance', 'full'];
      if (!validStatuses.includes(data.status)) {
        logger.warn(`Invalid status for bin ${binId}`, { status: data.status });
        return;
      }

      const bin = await Bin.findOneAndUpdate(
        { binId },
        {
          status: data.status,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (bin) {
        SocketService.emitBinUpdate(bin);

        logger.info(`Updated bin status for ${binId}`, {
          status: data.status,
          previousStatus: bin.status
        });

        // If status is maintenance, add alert
        if (data.status === 'maintenance') {
          bin.alerts.push({
            type: 'maintenance',
            message: `Bin ${binId} is under maintenance`,
            timestamp: new Date(),
            resolved: false
          });
          await bin.save();

          SocketService.emitAlert({
            type: 'maintenance',
            binId: bin.binId,
            timestamp: new Date(),
            message: `Bin ${bin.binId} is under maintenance`
          });
        }
      } else {
        logger.warn(`Bin ${binId} not found for status update`);
      }
    } catch (error) {
      logger.error(`Error handling bin status for ${binId}:`, error);
    }
  }

  /**
   * Handle alerts from bins
   */
  static async handleAlert(binId: string, data: AlertData): Promise<void> {
    try {
      // Validate alert type
      const validAlertTypes = ['full', 'overflow', 'maintenance', 'offline'];
      if (!validAlertTypes.includes(data.alertType)) {
        logger.warn(`Invalid alert type for bin ${binId}`, { type: data.alertType });
        return;
      }

      const bin = await Bin.findOne({ binId });

      if (bin) {
        // Check if similar unresolved alert already exists
        const hasUnresolvedAlert = bin.alerts.some(
          alert => alert.type === data.alertType && !alert.resolved
        );

        if (!hasUnresolvedAlert) {
          bin.alerts.push({
            type: data.alertType as any,
            message: data.message,
            timestamp: new Date(),
            resolved: false
          });
          await bin.save();

          // Emit alert via Socket.io
          SocketService.emitAlert({
            type: data.alertType,
            binId: bin.binId,
            message: data.message,
            severity: data.severity || 'medium',
            location: bin.location,
            timestamp: new Date()
          });

          logger.warn(`Alert received for bin ${binId}`, {
            type: data.alertType,
            message: data.message,
            severity: data.severity
          });
        } else {
          logger.debug(`Duplicate alert ignored for bin ${binId}`, {
            type: data.alertType
          });
        }
      } else {
        logger.warn(`Bin ${binId} not found for alert`);
      }
    } catch (error) {
      logger.error(`Error handling alert for ${binId}:`, error);
    }
  }

  /**
   * Resolve an alert for a bin
   */
  static async resolveAlert(binId: string, alertType: string): Promise<void> {
    try {
      const bin = await Bin.findOne({ binId });

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
          logger.info(`Alert resolved for bin ${binId}`, { type: alertType });
        }
      }
    } catch (error) {
      logger.error(`Error resolving alert for ${binId}:`, error);
    }
  }

  /**
   * Get unresolved alerts count
   */
  static async getUnresolvedAlertsCount(): Promise<number> {
    try {
      const bins = await Bin.find({
        'alerts': {
          $elemMatch: { resolved: false }
        }
      });

      let count = 0;
      bins.forEach(bin => {
        count += bin.alerts.filter(alert => !alert.resolved).length;
      });

      return count;
    } catch (error) {
      logger.error('Error getting unresolved alerts count:', error);
      return 0;
    }
  }
}

