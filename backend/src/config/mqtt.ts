import mqtt, { MqttClient } from 'mqtt';
import { config } from './config';
import { logger } from '@/utils/logger';

let mqttClient: MqttClient | null = null;

export const connectMQTT = async (): Promise<MqttClient | null> => {
  try {
    const brokerUrl = config.mqtt.brokerUrl;
    const clientId = config.mqtt.clientId;

    // Skip MQTT connection if using default localhost URL (no broker configured)
    if (!brokerUrl || !clientId || brokerUrl === 'mqtt://localhost:1883') {
      logger.warn('MQTT broker not configured, skipping MQTT connection');
      return null;
    }

    const connectOptions: any = {
      clientId,
      clean: true,
      connectTimeout: 30000, // 30 seconds timeout
      reconnectPeriod: 5000, // Auto-reconnect every 5 seconds
      keepalive: 60,
      protocolVersion: 4, // MQTT 3.1.1
    };

    // If using SSL/TLS (mqtts://), handle certificate verification
    if (brokerUrl.startsWith('mqtts://') || brokerUrl.startsWith('ssl://')) {
      connectOptions.rejectUnauthorized = false; // Disable cert verification for testing
      logger.warn('SSL/TLS connection: Certificate verification disabled (for testing only)');
    }

    if (config.mqtt.username) {
      connectOptions.username = config.mqtt.username;
    }
    if (config.mqtt.password) {
      connectOptions.password = config.mqtt.password;
    }

    logger.info(`Connecting to MQTT broker: ${brokerUrl}`);
    logger.debug('MQTT connection options:', {
      clientId,
      username: config.mqtt.username ? '***' : 'none',
      hasPassword: !!config.mqtt.password
    });

    mqttClient = mqtt.connect(brokerUrl, connectOptions);

    mqttClient.on('connect', () => {
      logger.info('Connected to MQTT broker successfully');

      // Subscribe to IoT device topics
      const topicPrefix = config.mqtt.topicPrefix || 'smartwaste';
      const topics = [
        `${topicPrefix}/+/data`,      // Bin sensor data: smartwaste/BIN001/data
        `${topicPrefix}/+/status`,    // Bin status: smartwaste/BIN001/status
        `${topicPrefix}/+/alert`      // Bin alerts: smartwaste/BIN001/alert
      ];

      topics.forEach(topic => {
        mqttClient?.subscribe(topic, (err) => {
          if (err) {
            logger.error(`Failed to subscribe to ${topic}:`, err);
          } else {
            logger.info(`Subscribed to MQTT topic: ${topic}`);
          }
        });
      });
    });

    // Handle incoming messages
    mqttClient.on('message', async (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        const { MQTTService } = await import('@/services/mqttService');
        await MQTTService.handleMessage(topic, data);
      } catch (error) {
        logger.error('Error processing MQTT message:', error);
      }
    });

    mqttClient.on('error', (error) => {
      logger.error('MQTT connection error:', error);
      logger.error('Error details:', {
        message: error.message,
        code: (error as any).code,
        brokerUrl: brokerUrl
      });
    });

    mqttClient.on('close', () => {
      logger.warn('MQTT connection closed');
    });

    mqttClient.on('reconnect', () => {
      logger.warn('MQTT reconnecting... (this might indicate network/firewall issues)');
    });

    mqttClient.on('offline', () => {
      logger.warn('MQTT client offline - check network/firewall settings');
    });

    return mqttClient;
  } catch (error) {
    logger.warn('MQTT connection failed, continuing without real-time updates:', error);
    return null;
  }
};

export const getMQTTClient = (): MqttClient | null => {
  return mqttClient;
};

export const disconnectMQTT = async (): Promise<void> => {
  if (mqttClient) {
    try {
      await mqttClient.end();
      logger.info('Disconnected from MQTT broker');
    } catch (error) {
      logger.error('Error disconnecting from MQTT:', error);
    }
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectMQTT();
  process.exit(0);
});
