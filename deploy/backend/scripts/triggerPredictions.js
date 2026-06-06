"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../config/config");
const Bin_1 = require("../models/Bin");
const mlClient_1 = require("../services/mlClient");
const Prediction_1 = require("../models/Prediction");
const logger_1 = require("../utils/logger");
async function triggerPredictions() {
    try {
        logger_1.logger.info('Starting manual prediction trigger...');
        await mongoose_1.default.connect(config_1.config.database.mongodbUri);
        logger_1.logger.info('✅ Connected to MongoDB');
        const activeBins = await Bin_1.Bin.find({ status: 'active' })
            .select('binId binType currentLevel capacity location')
            .limit(200)
            .lean();
        if (activeBins.length === 0) {
            logger_1.logger.info('No active bins found');
            await mongoose_1.default.disconnect();
            return;
        }
        logger_1.logger.info(`Found ${activeBins.length} active bins`);
        const mlClient = new mlClient_1.MLClient();
        const isHealthy = await mlClient.healthCheck();
        if (!isHealthy) {
            logger_1.logger.error('❌ ML service is not healthy. Please ensure it is running.');
            await mongoose_1.default.disconnect();
            process.exit(1);
        }
        logger_1.logger.info('✅ ML service is healthy');
        let successCount = 0;
        let failCount = 0;
        for (const bin of activeBins) {
            try {
                logger_1.logger.info(`Generating prediction for bin ${bin.binId}...`);
                const prediction = await mlClient.predictWaste(bin.binId, bin.binType, bin.currentLevel || 0, bin.capacity, bin.location, 24);
                await Prediction_1.Prediction.create({
                    binId: bin.binId,
                    horizonHours: 24,
                    predictedLevel: prediction.predicted_level,
                    timeToFullHours: prediction.time_to_full_hours ?? null,
                    riskLevel: prediction.risk_level,
                    recommendedCollectionTime: prediction.recommended_collection_time ? new Date(prediction.recommended_collection_time) : null,
                    confidence: prediction.confidence,
                    factors: prediction.factors ?? [],
                    source: 'ml-service',
                });
                logger_1.logger.info(`✅ Prediction created for ${bin.binId} - Source: ML Model, Confidence: ${prediction.confidence}`);
                successCount++;
                if (prediction.predicted_level >= 85) {
                    await Bin_1.Bin.updateOne({ binId: bin.binId }, { $set: { isOverflowing: true } });
                }
            }
            catch (err) {
                logger_1.logger.error(`❌ Prediction failed for bin ${bin.binId}`, {
                    error: err.message,
                    stack: err.stack,
                    response: err.response?.data,
                    status: err.response?.status,
                    statusText: err.response?.statusText,
                });
                failCount++;
            }
        }
        logger_1.logger.info(`\n📊 Prediction Summary:`);
        logger_1.logger.info(`   ✅ Successful: ${successCount}`);
        logger_1.logger.info(`   ❌ Failed: ${failCount}`);
        logger_1.logger.info(`   📈 Total: ${activeBins.length}`);
        await mongoose_1.default.disconnect();
        logger_1.logger.info('✅ Disconnected from MongoDB');
        logger_1.logger.info('✅ Manual prediction trigger completed!');
    }
    catch (error) {
        logger_1.logger.error('❌ Error in prediction trigger:', error);
        await mongoose_1.default.disconnect();
        process.exit(1);
    }
}
triggerPredictions();
//# sourceMappingURL=triggerPredictions.js.map