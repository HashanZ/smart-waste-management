"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../config/config");
const dataCollector_1 = require("../services/dataCollector");
const mlClient_1 = require("../services/mlClient");
const logger_1 = require("../utils/logger");
async function trainModel() {
    try {
        logger_1.logger.info("Starting ML model training...");
        await mongoose_1.default.connect(config_1.config.database.mongodbUri, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 30000,
            retryWrites: true,
            retryReads: true,
        });
        logger_1.logger.info("✅ Connected to MongoDB");
        logger_1.logger.info("Collecting training data...");
        const trainingData = await dataCollector_1.DataCollector.getTrainingData();
        if (trainingData.length < 50) {
            logger_1.logger.warn(`⚠️ Not enough data: ${trainingData.length} samples. Need at least 50.`);
            logger_1.logger.info("💡 Continue collecting data for a few days, then retry this script.");
            const stats = await dataCollector_1.DataCollector.getStats();
            logger_1.logger.info("📊 Data Collection Stats:", stats);
            await mongoose_1.default.disconnect();
            process.exit(0);
        }
        logger_1.logger.info(`✅ Found ${trainingData.length} training samples`);
        const formattedData = trainingData.map((d) => ({
            binId: d.binId,
            timestamp: d.timestamp instanceof Date ? d.timestamp.toISOString() : d.timestamp,
            fillLevel: d.fillLevel,
            binType: d.binType,
            latitude: d.location?.latitude || 0,
            longitude: d.location?.longitude || 0,
            dayOfWeek: d.dayOfWeek,
            hourOfDay: d.hourOfDay,
            actualFillLevel24h: d.actualFillLevel24h || d.fillLevel,
        }));
        logger_1.logger.info("🤖 Training ML model...");
        const mlClient = new mlClient_1.MLClient();
        const result = await mlClient.trainModel(formattedData);
        if (result.success) {
            logger_1.logger.info("✅ Model training successful!", {
                trainScore: result.train_score,
                testScore: result.test_score,
                samples: result.n_samples,
            });
            logger_1.logger.info(`📈 Model R² Score - Train: ${result.train_score?.toFixed(3)}, Test: ${result.test_score?.toFixed(3)}`);
            logger_1.logger.info("💾 Model saved to ml-service/models/");
        }
        else {
            logger_1.logger.error("❌ Model training failed", { message: result.message });
        }
        await mongoose_1.default.disconnect();
        logger_1.logger.info("✅ Disconnected from MongoDB");
        process.exit(result.success ? 0 : 1);
    }
    catch (error) {
        logger_1.logger.error("❌ Training script error");
        if (error instanceof Error) {
            logger_1.logger.error(`Error message: ${error.message}`);
            logger_1.logger.error(`Error stack: ${error.stack}`);
        }
        else {
            logger_1.logger.error(`Error: ${JSON.stringify(error)}`);
        }
        await mongoose_1.default.disconnect().catch(() => { });
        process.exit(1);
    }
}
trainModel();
//# sourceMappingURL=trainMLModel.js.map