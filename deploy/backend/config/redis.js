"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectRedis = exports.getRedisClient = exports.connectRedis = void 0;
const redis_1 = require("redis");
const config_1 = require("./config");
const logger_1 = require("../utils/logger");
let redisClient = null;
const connectRedis = async () => {
    try {
        const redisUrl = config_1.config.database.redisUrl;
        if (!redisUrl || redisUrl === 'redis://localhost:6379') {
            logger_1.logger.info('Redis not configured, skipping Redis connection');
            return null;
        }
        redisClient = (0, redis_1.createClient)({
            url: redisUrl,
            socket: {
                reconnectStrategy: (retries) => Math.min(retries * 50, 500)
            }
        });
        redisClient.on('error', (error) => {
            logger_1.logger.error('Redis Client Error:', error);
        });
        redisClient.on('connect', () => {
            logger_1.logger.info('Redis Client Connected');
        });
        redisClient.on('ready', () => {
            logger_1.logger.info('Redis Client Ready');
        });
        redisClient.on('end', () => {
            logger_1.logger.warn('Redis Client Disconnected');
        });
        await redisClient.connect();
        logger_1.logger.info('Connected to Redis successfully');
        return redisClient;
    }
    catch (error) {
        logger_1.logger.warn('Redis connection failed, continuing without cache:', error);
        return null;
    }
};
exports.connectRedis = connectRedis;
const getRedisClient = () => {
    return redisClient;
};
exports.getRedisClient = getRedisClient;
const disconnectRedis = async () => {
    if (redisClient) {
        try {
            await redisClient.quit();
            logger_1.logger.info('Disconnected from Redis');
        }
        catch (error) {
            logger_1.logger.error('Error disconnecting from Redis:', error);
        }
    }
};
exports.disconnectRedis = disconnectRedis;
process.on('SIGINT', async () => {
    await (0, exports.disconnectRedis)();
    process.exit(0);
});
//# sourceMappingURL=redis.js.map