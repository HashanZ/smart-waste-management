"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDatabase = exports.connectDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("./config");
const logger_1 = require("../utils/logger");
const connectDatabase = async (retries = 3) => {
    const mongoUri = config_1.config.database.mongodbUri;
    if (!mongoUri) {
        throw new Error('MongoDB URI is not defined');
    }
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            logger_1.logger.info(`Attempting to connect to MongoDB (attempt ${attempt}/${retries})...`);
            if (mongoose_1.default.connection.readyState === 1) {
                logger_1.logger.info('Already connected to MongoDB');
                return;
            }
            await mongoose_1.default.connect(mongoUri, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 30000,
                socketTimeoutMS: 45000,
                connectTimeoutMS: 30000,
                retryWrites: true,
                retryReads: true,
            });
            logger_1.logger.info('✅ Connected to MongoDB successfully');
            return;
        }
        catch (error) {
            logger_1.logger.warn(`MongoDB connection attempt ${attempt}/${retries} failed:`, error.message);
            if (attempt < retries) {
                const waitTime = attempt * 2000;
                logger_1.logger.info(`Retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            else {
                logger_1.logger.error('❌ All MongoDB connection attempts failed');
                throw error;
            }
        }
    }
};
exports.connectDatabase = connectDatabase;
const disconnectDatabase = async () => {
    try {
        await mongoose_1.default.disconnect();
        logger_1.logger.info('Disconnected from MongoDB');
    }
    catch (error) {
        logger_1.logger.error('Error disconnecting from MongoDB:', error);
    }
};
exports.disconnectDatabase = disconnectDatabase;
mongoose_1.default.connection.on('connected', () => {
    logger_1.logger.info('Mongoose connected to MongoDB');
});
mongoose_1.default.connection.on('error', (error) => {
    logger_1.logger.error('Mongoose connection error:', error);
});
mongoose_1.default.connection.on('disconnected', () => {
    logger_1.logger.warn('Mongoose disconnected from MongoDB');
});
process.on('SIGINT', async () => {
    await (0, exports.disconnectDatabase)();
    process.exit(0);
});
//# sourceMappingURL=database.js.map