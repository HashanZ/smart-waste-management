"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePredictionAccuracy = generatePredictionAccuracy;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../config/config");
const Bin_1 = require("../models/Bin");
const Prediction_1 = require("../models/Prediction");
const PredictionAccuracy_1 = require("../models/PredictionAccuracy");
const logger_1 = require("../utils/logger");
async function generatePredictionAccuracy() {
    try {
        logger_1.logger.info("📈 Generating prediction accuracy records...");
        await mongoose_1.default.connect(config_1.config.database.mongodbUri);
        logger_1.logger.info("✅ Connected to MongoDB");
        const db = mongoose_1.default.connection.db;
        if (!db) {
            throw new Error("Database connection not available");
        }
        const binHistoryCollection = db.collection("bin_history");
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const predictions = await Prediction_1.Prediction.find({
            createdAt: { $gte: sevenDaysAgo },
            horizonHours: 24,
        })
            .sort({ createdAt: -1 })
            .limit(500)
            .lean();
        logger_1.logger.info(`Found ${predictions.length} predictions to evaluate`);
        if (predictions.length === 0) {
            logger_1.logger.warn("⚠️  No predictions found. Please generate predictions first.");
            await mongoose_1.default.disconnect();
            return;
        }
        const predictionsByDate = new Map();
        for (const pred of predictions) {
            const date = new Date(pred.createdAt);
            date.setHours(0, 0, 0, 0);
            const dateKey = date.toISOString().split("T")[0];
            if (!dateKey) {
                continue;
            }
            if (!predictionsByDate.has(dateKey)) {
                predictionsByDate.set(dateKey, []);
            }
            const dayPredictions = predictionsByDate.get(dateKey);
            if (dayPredictions) {
                dayPredictions.push(pred);
            }
        }
        logger_1.logger.info(`Processing ${predictionsByDate.size} days of predictions`);
        let totalAccuracyRecords = 0;
        for (const [dateKey, dayPredictions] of predictionsByDate) {
            const accuracyData = [];
            for (const pred of dayPredictions) {
                const predictionTime = new Date(pred.createdAt);
                const actualTime = new Date(predictionTime.getTime() + 24 * 60 * 60 * 1000);
                const actualEntry = await binHistoryCollection.findOne({
                    binId: pred.binId,
                    timestamp: {
                        $gte: new Date(actualTime.getTime() - 2 * 60 * 60 * 1000),
                        $lte: new Date(actualTime.getTime() + 2 * 60 * 60 * 1000),
                    },
                });
                if (actualEntry) {
                    const actualLevel = actualEntry["fillLevel"] || 0;
                    accuracyData.push({
                        predicted: pred.predictedLevel,
                        actual: actualLevel,
                        source: pred.source || "ml-service",
                    });
                }
                else {
                    const bin = await Bin_1.Bin.findOne({ binId: pred.binId }).lean();
                    if (bin && bin.currentLevel !== undefined) {
                        accuracyData.push({
                            predicted: pred.predictedLevel,
                            actual: bin.currentLevel,
                            source: pred.source || "ml-service",
                        });
                    }
                }
            }
            if (accuracyData.length === 0) {
                logger_1.logger.warn(`   ⚠️  No accuracy data for ${dateKey}`);
                continue;
            }
            const errors = accuracyData.map((d) => Math.abs(d.predicted - d.actual));
            const squaredErrors = errors.map((e) => e * e);
            const percentageErrors = accuracyData.map((d) => (d.actual > 0 ? (Math.abs(d.predicted - d.actual) / d.actual) * 100 : 0));
            const mae = errors.reduce((sum, e) => sum + e, 0) / errors.length;
            const rmse = Math.sqrt(squaredErrors.reduce((sum, e) => sum + e, 0) / squaredErrors.length);
            const mape = percentageErrors.reduce((sum, e) => sum + e, 0) / percentageErrors.length;
            const mlData = accuracyData.filter((d) => d.source === "ml-service");
            const fallbackData = accuracyData.filter((d) => d.source === "fallback");
            const date = new Date(dateKey);
            if (accuracyData.length > 0) {
                await PredictionAccuracy_1.PredictionAccuracy.create({
                    binId: null,
                    date,
                    mae,
                    rmse,
                    mape,
                    sampleCount: accuracyData.length,
                    source: "aggregate",
                });
                totalAccuracyRecords++;
            }
            if (mlData.length > 0) {
                const mlErrors = mlData.map((d) => Math.abs(d.predicted - d.actual));
                const mlSquaredErrors = mlErrors.map((e) => e * e);
                const mlPercentageErrors = mlData.map((d) => (d.actual > 0 ? (Math.abs(d.predicted - d.actual) / d.actual) * 100 : 0));
                const mlMae = mlErrors.reduce((sum, e) => sum + e, 0) / mlErrors.length;
                const mlRmse = Math.sqrt(mlSquaredErrors.reduce((sum, e) => sum + e, 0) / mlSquaredErrors.length);
                const mlMape = mlPercentageErrors.reduce((sum, e) => sum + e, 0) / mlPercentageErrors.length;
                await PredictionAccuracy_1.PredictionAccuracy.create({
                    binId: null,
                    date,
                    mae: mlMae,
                    rmse: mlRmse,
                    mape: mlMape,
                    sampleCount: mlData.length,
                    source: "ml-service",
                });
                totalAccuracyRecords++;
            }
            if (fallbackData.length > 0) {
                const fallbackErrors = fallbackData.map((d) => Math.abs(d.predicted - d.actual));
                const fallbackSquaredErrors = fallbackErrors.map((e) => e * e);
                const fallbackPercentageErrors = fallbackData.map((d) => (d.actual > 0 ? (Math.abs(d.predicted - d.actual) / d.actual) * 100 : 0));
                const fallbackMae = fallbackErrors.reduce((sum, e) => sum + e, 0) / fallbackErrors.length;
                const fallbackRmse = Math.sqrt(fallbackSquaredErrors.reduce((sum, e) => sum + e, 0) / fallbackSquaredErrors.length);
                const fallbackMape = fallbackPercentageErrors.reduce((sum, e) => sum + e, 0) / fallbackPercentageErrors.length;
                await PredictionAccuracy_1.PredictionAccuracy.create({
                    binId: null,
                    date,
                    mae: fallbackMae,
                    rmse: fallbackRmse,
                    mape: fallbackMape,
                    sampleCount: fallbackData.length,
                    source: "fallback",
                });
                totalAccuracyRecords++;
            }
            logger_1.logger.info(`   ✅ Processed ${dateKey}: ${accuracyData.length} samples, MAE: ${mae.toFixed(2)}`);
        }
        logger_1.logger.info(`\n✅ Created ${totalAccuracyRecords} prediction accuracy records`);
        logger_1.logger.info("\n💡 Now refresh the Analytics page to see ML Prediction Analytics data!");
        await mongoose_1.default.disconnect();
        logger_1.logger.info("✅ Disconnected from MongoDB");
    }
    catch (error) {
        logger_1.logger.error("❌ Error:", error);
        await mongoose_1.default.disconnect();
        process.exit(1);
    }
}
if (require.main === module) {
    generatePredictionAccuracy().catch((error) => {
        logger_1.logger.error("Script failed:", error);
        process.exit(1);
    });
}
//# sourceMappingURL=generatePredictionAccuracy.js.map