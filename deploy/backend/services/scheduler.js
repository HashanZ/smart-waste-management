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
exports.SchedulerService = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("../utils/logger");
const Bin_1 = require("../models/Bin");
const Prediction_1 = require("../models/Prediction");
const Collection_1 = require("../models/Collection");
const User_1 = require("../models/User");
class SchedulerService {
    static start() {
        node_cron_1.default.schedule('5 * * * *', async () => {
            await SchedulerService.runHourlyPredictions();
        }, { timezone: 'UTC' });
        node_cron_1.default.schedule('0 */6 * * *', async () => {
            await SchedulerService.scheduleAutomaticCollections();
        }, { timezone: 'UTC' });
        node_cron_1.default.schedule('0 1 * * *', async () => {
            await SchedulerService.runDailyAccuracyTracking();
        }, { timezone: 'UTC' });
        node_cron_1.default.schedule('0 2 * * 0', async () => {
            await SchedulerService.runWeeklyModelRetraining();
        }, { timezone: 'UTC' });
        setTimeout(() => {
            SchedulerService.scheduleAutomaticCollections();
        }, 60000);
        logger_1.logger.info('SchedulerService started: hourly predictions, automatic collection scheduling, daily accuracy tracking, and weekly model retraining enabled');
    }
    static async runHourlyPredictions() {
        try {
            logger_1.logger.info('Hourly prediction job started');
            const activeBins = await Bin_1.Bin.find({ status: 'active' })
                .select('binId binType currentLevel capacity location')
                .limit(200)
                .lean();
            if (activeBins.length === 0) {
                logger_1.logger.info('Hourly prediction job: no active bins');
                return;
            }
            const { MLClient } = await Promise.resolve().then(() => __importStar(require('./mlClient')));
            const mlClient = new MLClient();
            for (const bin of activeBins) {
                try {
                    const prediction = await mlClient.predictWaste(bin.binId, bin.binType, bin.currentLevel, bin.capacity, bin.location, 24);
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
                    if (prediction.predicted_level >= 85) {
                        await Bin_1.Bin.updateOne({ binId: bin.binId }, { $set: { isOverflowing: true } });
                    }
                }
                catch (err) {
                    logger_1.logger.warn('Hourly prediction failed for bin', { binId: bin.binId, err });
                }
            }
            logger_1.logger.info('Hourly prediction job completed', { count: activeBins.length });
        }
        catch (error) {
            logger_1.logger.error('Hourly prediction job error', { error });
        }
    }
    static async scheduleAutomaticCollections() {
        try {
            logger_1.logger.info('Automatic collection scheduling job started');
            const binsNeedingCollection = await Bin_1.Bin.find({
                status: 'active',
                $or: [
                    { isOverflowing: true },
                    { currentLevel: { $gte: 70 } },
                ],
            })
                .select('binId binType currentLevel capacity location')
                .limit(100)
                .lean();
            if (binsNeedingCollection.length === 0) {
                logger_1.logger.info('Automatic collection scheduling: no bins need collection');
                return;
            }
            const defaultCollector = await User_1.User.findOne({
                $or: [
                    { role: 'collector', isActive: true },
                    { role: 'admin', isActive: true },
                ],
            })
                .select('_id firstName lastName email')
                .lean();
            if (!defaultCollector) {
                logger_1.logger.warn('Automatic collection scheduling: no collector found, skipping');
                return;
            }
            const existingCollections = await Collection_1.Collection.find({
                binId: { $in: binsNeedingCollection.map(b => b.binId) },
                status: { $in: ['scheduled', 'in_progress'] },
                scheduledDate: {
                    $gte: new Date(),
                },
            })
                .select('binId')
                .lean();
            const binsWithExistingCollections = new Set(existingCollections.map(c => c.binId));
            let scheduledCount = 0;
            const now = new Date();
            for (const bin of binsNeedingCollection) {
                if (binsWithExistingCollections.has(bin.binId)) {
                    continue;
                }
                try {
                    let priority = 'medium';
                    if (bin.currentLevel >= 90 || bin.isOverflowing) {
                        priority = 'urgent';
                    }
                    else if (bin.currentLevel >= 85) {
                        priority = 'high';
                    }
                    else if (bin.currentLevel >= 70) {
                        priority = 'medium';
                    }
                    const scheduledDate = new Date(now);
                    if (priority === 'urgent' || priority === 'high') {
                        scheduledDate.setHours(scheduledDate.getHours() + 6);
                    }
                    else {
                        scheduledDate.setHours(scheduledDate.getHours() + 24);
                    }
                    const collectionCount = await Collection_1.Collection.countDocuments();
                    const collectionId = `COL${String(collectionCount + 1).padStart(6, '0')}`;
                    await Collection_1.Collection.create({
                        collectionId,
                        binId: bin.binId,
                        bin: {
                            binId: bin.binId,
                            binType: bin.binType,
                            location: bin.location || { latitude: 0, longitude: 0 },
                        },
                        collectorId: defaultCollector._id.toString(),
                        collector: {
                            firstName: defaultCollector.firstName,
                            lastName: defaultCollector.lastName,
                            email: defaultCollector.email,
                        },
                        scheduledDate,
                        status: 'scheduled',
                        wasteType: bin.binType,
                        priority,
                    });
                    scheduledCount++;
                    logger_1.logger.info(`Scheduled automatic collection for bin ${bin.binId}`, {
                        binId: bin.binId,
                        priority,
                        scheduledDate,
                    });
                }
                catch (err) {
                    logger_1.logger.warn('Failed to schedule collection for bin', {
                        binId: bin.binId,
                        error: err.message,
                    });
                }
            }
            logger_1.logger.info('Automatic collection scheduling job completed', {
                binsChecked: binsNeedingCollection.length,
                scheduled: scheduledCount,
                skipped: binsNeedingCollection.length - scheduledCount,
            });
        }
        catch (error) {
            logger_1.logger.error('Automatic collection scheduling job error', { error });
        }
    }
    static async runDailyAccuracyTracking() {
        try {
            const { DataCollector } = await Promise.resolve().then(() => __importStar(require('./dataCollector')));
            await DataCollector.runDailyAccuracyTracking();
        }
        catch (error) {
            logger_1.logger.error('Daily accuracy tracking job error', { error });
        }
    }
    static async runWeeklyModelRetraining() {
        try {
            logger_1.logger.info('Starting weekly model retraining');
            const { DataCollector } = await Promise.resolve().then(() => __importStar(require('./dataCollector')));
            const stats = await DataCollector.getStats();
            if (stats.entriesWithLabels < 50) {
                logger_1.logger.warn('Not enough training data for model retraining', {
                    entriesWithLabels: stats.entriesWithLabels,
                    minimumRequired: 50,
                });
                return;
            }
            logger_1.logger.info('Training data available', {
                entriesWithLabels: stats.entriesWithLabels,
                binsTracked: stats.binsTracked,
            });
            const { exec } = require('child_process');
            const path = require('path');
            const backendDir = path.join(__dirname, '..', '..');
            exec('npm run train:ml', {
                cwd: backendDir,
                maxBuffer: 10 * 1024 * 1024,
            }, (error, stdout, stderr) => {
                if (error) {
                    logger_1.logger.error('Model retraining failed', {
                        error: error.message,
                        code: error.code,
                        signal: error.signal,
                        stderr,
                    });
                    return;
                }
                logger_1.logger.info('Model retraining completed successfully', {
                    stdout: stdout.substring(0, 500),
                    stderr: stderr || 'none',
                });
                if (stdout.includes('success') || stdout.includes('completed')) {
                    logger_1.logger.info('✅ ML model retraining completed - model should be reloaded automatically');
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Model retraining error', { error });
        }
    }
}
exports.SchedulerService = SchedulerService;
//# sourceMappingURL=scheduler.js.map