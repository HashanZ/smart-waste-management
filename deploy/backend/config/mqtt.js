"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectMQTT = exports.getMQTTClient = exports.connectMQTT = void 0;
const mqtt_1 = __importDefault(require("mqtt"));
const config_1 = require("./config");
const logger_1 = require("../utils/logger");
let mqttClient = null;
const connectMQTT = async () => {
    try {
        const brokerUrl = config_1.config.mqtt.brokerUrl;
        const clientId = config_1.config.mqtt.clientId;
        if (!brokerUrl || !clientId || brokerUrl === 'mqtt://localhost:1883') {
            logger_1.logger.warn('MQTT broker not configured, skipping MQTT connection');
            return null;
        }
        const connectOptions = {
            clientId,
            clean: true,
            connectTimeout: 30000,
            reconnectPeriod: 5000,
            keepalive: 60,
            protocolVersion: 4,
        };
        if (brokerUrl.startsWith('mqtts://') || brokerUrl.startsWith('ssl://')) {
            connectOptions.rejectUnauthorized = false;
            logger_1.logger.warn('SSL/TLS connection: Certificate verification disabled (for testing only)');
        }
        if (config_1.config.mqtt.username) {
            connectOptions.username = config_1.config.mqtt.username;
        }
        if (config_1.config.mqtt.password) {
            connectOptions.password = config_1.config.mqtt.password;
        }
        logger_1.logger.info(`Connecting to MQTT broker: ${brokerUrl}`);
        logger_1.logger.debug('MQTT connection options:', {
            clientId,
            username: config_1.config.mqtt.username ? '***' : 'none',
            hasPassword: !!config_1.config.mqtt.password
        });
        mqttClient = mqtt_1.default.connect(brokerUrl, connectOptions);
        mqttClient.on('connect', () => {
            logger_1.logger.info('Connected to MQTT broker successfully');
            const topicPrefix = config_1.config.mqtt.topicPrefix || 'smartwaste';
            const topics = [
                `${topicPrefix}/+/data`,
                `${topicPrefix}/+/status`,
                `${topicPrefix}/+/alert`
            ];
            topics.forEach(topic => {
                mqttClient?.subscribe(topic, (err) => {
                    if (err) {
                        logger_1.logger.error(`Failed to subscribe to ${topic}:`, err);
                    }
                    else {
                        logger_1.logger.info(`Subscribed to MQTT topic: ${topic}`);
                    }
                });
            });
        });
        mqttClient.on('message', async (topic, message) => {
            try {
                const data = JSON.parse(message.toString());
                const { MQTTService } = await Promise.resolve().then(() => __importStar(require('../services/mqttService')));
                await MQTTService.handleMessage(topic, data);
            }
            catch (error) {
                logger_1.logger.error('Error processing MQTT message:', error);
            }
        });
        mqttClient.on('error', (error) => {
            logger_1.logger.error('MQTT connection error:', error);
            logger_1.logger.error('Error details:', {
                message: error.message,
                code: error.code,
                brokerUrl: brokerUrl
            });
        });
        mqttClient.on('close', () => {
            logger_1.logger.warn('MQTT connection closed');
        });
        mqttClient.on('reconnect', () => {
            logger_1.logger.warn('MQTT reconnecting... (this might indicate network/firewall issues)');
        });
        mqttClient.on('offline', () => {
            logger_1.logger.warn('MQTT client offline - check network/firewall settings');
        });
        return mqttClient;
    }
    catch (error) {
        logger_1.logger.warn('MQTT connection failed, continuing without real-time updates:', error);
        return null;
    }
};
exports.connectMQTT = connectMQTT;
const getMQTTClient = () => {
    return mqttClient;
};
exports.getMQTTClient = getMQTTClient;
const disconnectMQTT = async () => {
    if (mqttClient) {
        try {
            await mqttClient.end();
            logger_1.logger.info('Disconnected from MQTT broker');
        }
        catch (error) {
            logger_1.logger.error('Error disconnecting from MQTT:', error);
        }
    }
};
exports.disconnectMQTT = disconnectMQTT;
process.on('SIGINT', async () => {
    await (0, exports.disconnectMQTT)();
    process.exit(0);
});
//# sourceMappingURL=mqtt.js.map