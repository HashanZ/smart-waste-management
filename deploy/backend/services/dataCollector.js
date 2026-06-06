"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataCollector = void 0;
const Bin_1 = require("../models/Bin");
const Prediction_1 = require("../models/Prediction");
const PredictionAccuracy_1 = require("../models/PredictionAccuracy");
const logger_1 = require("../utils/logger");
const mongoose_1 = __importDefault(require("mongoose"));
class DataCollector {
    static start() {
        this.collectionInterval = setInterval(async () => {
            await this.collectBinData();
        }, 60 * 60 * 1000);
        this.collectBinData();
        logger_1.logger.info("DataCollector started: collecting bin data every hour");
    }
    static stop() {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = null;
            logger_1.logger.info("DataCollector stopped");
        }
    }
    static async collectBinData() {
        try {
            const bins = await Bin_1.Bin.find({ status: "active" }).lean();
            const now = new Date();
            if (bins.length === 0) {
                logger_1.logger.warn("No active bins found for data collection");
                return;
            }
            let accuracyUpdatesCount = 0;
            for (const bin of bins) {
                await this.storeBinHistory({
                    binId: bin.binId,
                    timestamp: now,
                    fillLevel: bin.currentLevel || 0,
                    binType: bin.binType,
                    location: {
                        latitude: bin.location?.latitude || 0,
                        longitude: bin.location?.longitude || 0,
                    },
                    dayOfWeek: now.getDay(),
                    hourOfDay: now.getHours(),
                    wasCollected: false,
                });
                await this.detectCollection(bin.binId, bin.currentLevel || 0);
                const hadAccuracyUpdate = await this.update24hPredictions(bin.binId);
                if (hadAccuracyUpdate) {
                    accuracyUpdatesCount++;
                }
            }
            logger_1.logger.info(`Collected data for ${bins.length} bin(s)`);
            if (accuracyUpdatesCount > 0) {
                logger_1.logger.debug(`Updated prediction accuracy for ${accuracyUpdatesCount} bin(s)`);
            }
        }
        catch (error) {
            logger_1.logger.error("Data collection error", { error });
        }
    }
    static async detectCollection(binId, currentLevel) {
        const db = mongoose_1.default.connection.db;
        if (!db)
            return;
        const collection = db.collection("bin_history");
        const lastEntry = await collection.findOne({ binId }, { sort: { timestamp: -1 } });
        if (lastEntry && lastEntry["fillLevel"] > currentLevel + 30) {
            await collection.updateOne({ binId, timestamp: lastEntry["timestamp"] }, { $set: { wasCollected: true } });
            logger_1.logger.info(`Detected collection for bin ${binId}`);
        }
    }
    static async storeBinHistory(entry) {
        const db = mongoose_1.default.connection.db;
        if (!db)
            return;
        try {
            const collection = db.collection("bin_history");
            await collection.insertOne(entry);
        }
        catch (error) {
            logger_1.logger.error("Failed to store bin history", {
                error,
                binId: entry.binId,
            });
        }
    }
    static async update24hPredictions(binId) {
        const db = mongoose_1.default.connection.db;
        if (!db)
            return false;
        const collection = db.collection("bin_history");
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const oldEntry = await collection.findOne({
            binId,
            timestamp: {
                $gte: oneDayAgo,
                $lte: new Date(oneDayAgo.getTime() + 60 * 60 * 1000),
            },
        });
        if (oldEntry) {
            const bin = await Bin_1.Bin.findOne({ binId }).lean();
            if (bin) {
                await collection.updateOne({ _id: oldEntry._id }, { $set: { actualFillLevel24h: bin.currentLevel || 0 } });
            }
        }
        const now = new Date();
        const oneDayAgoStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        oneDayAgoStart.setHours(0, 0, 0, 0);
        const oneDayAgoEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        oneDayAgoEnd.setHours(23, 59, 59, 999);
        const predictionCount = await Prediction_1.Prediction.countDocuments({
            binId,
            createdAt: {
                $gte: oneDayAgoStart,
                $lte: oneDayAgoEnd,
            },
            horizonHours: 24,
        });
        if (predictionCount > 0) {
            await this.updatePredictionAccuracy(binId);
            return true;
        }
        return false;
    }
    static async updatePredictionAccuracy(binId) {
        try {
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const oneDayAgoStart = new Date(oneDayAgo);
            oneDayAgoStart.setHours(0, 0, 0, 0);
            const oneDayAgoEnd = new Date(oneDayAgo);
            oneDayAgoEnd.setHours(23, 59, 59, 999);
            const predictionQuery = {
                createdAt: {
                    $gte: oneDayAgoStart,
                    $lte: oneDayAgoEnd,
                },
                horizonHours: 24,
            };
            if (binId) {
                predictionQuery.binId = binId;
            }
            const predictions = await Prediction_1.Prediction.find(predictionQuery)
                .sort({ createdAt: -1 })
                .lean();
            if (predictions.length === 0) {
                logger_1.logger.debug('No predictions found for accuracy tracking', { binId, date: oneDayAgo });
                return;
            }
            const db = mongoose_1.default.connection.db;
            if (!db)
                return;
            const binHistoryCollection = db.collection("bin_history");
            const accuracyData = [];
            for (const pred of predictions) {
                const predictionTime = new Date(pred.createdAt);
                const actualTime = new Date(predictionTime.getTime() + 24 * 60 * 60 * 1000);
                const actualEntry = await binHistoryCollection.findOne({
                    binId: pred.binId,
                    timestamp: {
                        $gte: new Date(actualTime.getTime() - 60 * 60 * 1000),
                        $lte: new Date(actualTime.getTime() + 60 * 60 * 1000),
                    },
                });
                let actualLevel = null;
                if (actualEntry) {
                    actualLevel = actualEntry["fillLevel"] || 0;
                }
                else {
                    const bin = await Bin_1.Bin.findOne({ binId: pred.binId }).lean();
                    if (bin) {
                        actualLevel = bin.currentLevel || 0;
                    }
                }
                if (actualLevel !== null) {
                    accuracyData.push({
                        predicted: pred.predictedLevel,
                        actual: actualLevel,
                        source: pred.source,
                    });
                }
            }
            if (accuracyData.length === 0) {
                logger_1.logger.debug('No accuracy data available', { binId, predictionsCount: predictions.length });
                return;
            }
            const metricsBySource = {};
            accuracyData.forEach((data) => {
                if (!metricsBySource[data.source]) {
                    metricsBySource[data.source] = {
                        errors: [],
                        percentageErrors: [],
                    };
                }
                const error = Math.abs(data.predicted - data.actual);
                const percentageError = data.actual > 0 ? (error / data.actual) * 100 : 0;
                const sourceMetrics = metricsBySource[data.source];
                if (sourceMetrics) {
                    sourceMetrics.errors.push(error);
                    sourceMetrics.percentageErrors.push(percentageError);
                }
            });
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            for (const [source, data] of Object.entries(metricsBySource)) {
                if (data.errors.length === 0)
                    continue;
                const mae = data.errors.reduce((sum, e) => sum + e, 0) / data.errors.length;
                const rmse = Math.sqrt(data.errors.reduce((sum, e) => sum + e * e, 0) / data.errors.length);
                const mape = data.percentageErrors.reduce((sum, e) => sum + e, 0) / data.percentageErrors.length;
                await PredictionAccuracy_1.PredictionAccuracy.findOneAndUpdate({
                    binId: binId || null,
                    date: today,
                    source: source,
                }, {
                    $set: {
                        mae: parseFloat(mae.toFixed(2)),
                        rmse: parseFloat(rmse.toFixed(2)),
                        mape: parseFloat(mape.toFixed(2)),
                        sampleCount: data.errors.length,
                    },
                }, {
                    upsert: true,
                    new: true,
                });
                logger_1.logger.debug('Prediction accuracy updated', {
                    binId: binId || 'all',
                    source,
                    mae: parseFloat(mae.toFixed(2)),
                    rmse: parseFloat(rmse.toFixed(2)),
                    mape: parseFloat(mape.toFixed(2)),
                    sampleCount: data.errors.length,
                });
            }
            const allErrors = accuracyData.map((d) => Math.abs(d.predicted - d.actual));
            const allPercentageErrors = accuracyData.map((d) => d.actual > 0 ? (Math.abs(d.predicted - d.actual) / d.actual) * 100 : 0);
            if (allErrors.length > 0) {
                const aggregateMae = allErrors.reduce((sum, e) => sum + e, 0) / allErrors.length;
                const aggregateRmse = Math.sqrt(allErrors.reduce((sum, e) => sum + e * e, 0) / allErrors.length);
                const aggregateMape = allPercentageErrors.reduce((sum, e) => sum + e, 0) / allPercentageErrors.length;
                await PredictionAccuracy_1.PredictionAccuracy.findOneAndUpdate({
                    binId: binId || null,
                    date: today,
                    source: 'aggregate',
                }, {
                    $set: {
                        mae: parseFloat(aggregateMae.toFixed(2)),
                        rmse: parseFloat(aggregateRmse.toFixed(2)),
                        mape: parseFloat(aggregateMape.toFixed(2)),
                        sampleCount: allErrors.length,
                    },
                }, {
                    upsert: true,
                    new: true,
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Prediction accuracy tracking error', {
                error,
                binId,
            });
        }
    }
    static async runDailyAccuracyTracking() {
        try {
            logger_1.logger.info('Running daily prediction accuracy tracking');
            await this.updatePredictionAccuracy();
            logger_1.logger.info('Daily prediction accuracy tracking completed');
        }
        catch (error) {
            logger_1.logger.error('Daily accuracy tracking error', { error });
        }
    }
    static async getTrainingData(binId) {
        const db = mongoose_1.default.connection.db;
        if (!db)
            return [];
        const collection = db.collection("bin_history");
        const query = {
            actualFillLevel24h: { $exists: true },
        };
        if (binId) {
            query.binId = binId;
        }
        try {
            const data = await collection
                .find(query)
                .sort({ timestamp: -1 })
                .limit(1000)
                .toArray();
            return data.map((doc) => ({
                binId: doc.binId || doc["binId"],
                timestamp: doc.timestamp instanceof Date
                    ? doc.timestamp
                    : new Date(doc.timestamp || doc["timestamp"]),
                fillLevel: doc.fillLevel || doc["fillLevel"],
                binType: doc.binType || doc["binType"],
                location: doc.location ||
                    doc["location"] || { latitude: 0, longitude: 0 },
                dayOfWeek: doc.dayOfWeek || doc["dayOfWeek"],
                hourOfDay: doc.hourOfDay || doc["hourOfDay"],
                wasCollected: doc.wasCollected || doc["wasCollected"] || false,
                actualFillLevel24h: doc.actualFillLevel24h || doc["actualFillLevel24h"],
            }));
        }
        catch (error) {
            logger_1.logger.error("Failed to get training data", { error });
            return [];
        }
    }
    static async exportTrainingData(binId) {
        const data = await this.getTrainingData(binId);
        const csv = [
            "binId,timestamp,fillLevel,binType,latitude,longitude,dayOfWeek,hourOfDay,actualFillLevel24h",
            ...data.map((d) => [
                d.binId,
                d.timestamp.toISOString(),
                d.fillLevel,
                d.binType,
                d.location.latitude,
                d.location.longitude,
                d.dayOfWeek,
                d.hourOfDay,
                d.actualFillLevel24h || "",
            ].join(",")),
        ].join("\n");
        return csv;
    }
    static async getStats() {
        const db = mongoose_1.default.connection.db;
        if (!db) {
            return {
                totalEntries: 0,
                entriesWithLabels: 0,
                binsTracked: 0,
                oldestEntry: null,
                newestEntry: null,
            };
        }
        const collection = db.collection("bin_history");
        const [totalEntries, entriesWithLabels, oldest, newest, bins] = await Promise.all([
            collection.countDocuments(),
            collection.countDocuments({ actualFillLevel24h: { $exists: true } }),
            collection.findOne({}, { sort: { timestamp: 1 } }),
            collection.findOne({}, { sort: { timestamp: -1 } }),
            collection.distinct("binId"),
        ]);
        const getTimestamp = (doc) => {
            if (!doc)
                return null;
            const ts = doc["timestamp"] || doc.timestamp;
            if (!ts)
                return null;
            return ts instanceof Date ? ts : new Date(ts);
        };
        return {
            totalEntries,
            entriesWithLabels,
            binsTracked: bins.length,
            oldestEntry: getTimestamp(oldest),
            newestEntry: getTimestamp(newest),
        };
    }
}
exports.DataCollector = DataCollector;
DataCollector.collectionInterval = null;
//# sourceMappingURL=dataCollector.js.map