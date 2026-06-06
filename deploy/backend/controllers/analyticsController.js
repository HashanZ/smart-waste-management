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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const response_1 = require("../utils/response");
const logger_1 = require("../utils/logger");
const Bin_1 = require("../models/Bin");
const Collection_1 = require("../models/Collection");
const Route_1 = require("../models/Route");
const Prediction_1 = require("../models/Prediction");
const date_fns_1 = require("date-fns");
class AnalyticsController {
    static async getMetrics(req, res) {
        try {
            const { startDate, endDate, binType } = req.query;
            const dateFilter = {};
            if (startDate)
                dateFilter.$gte = new Date(startDate);
            if (endDate)
                dateFilter.$lte = new Date(endDate);
            const binTypeFilter = {};
            if (binType)
                binTypeFilter.binType = String(binType);
            const [totalBins, activeBins, overflowingBins, maintenanceBins, inactiveBins, avgFillLevel, wasteByType, collectionsToday,] = await Promise.all([
                Bin_1.Bin.countDocuments(),
                Bin_1.Bin.countDocuments({ status: "active" }),
                Bin_1.Bin.countDocuments({ isOverflowing: true }),
                Bin_1.Bin.countDocuments({ status: "maintenance" }),
                Bin_1.Bin.countDocuments({ status: "inactive" }),
                Bin_1.Bin.aggregate([
                    { $match: { currentLevel: { $exists: true, $ne: null } } },
                    { $group: { _id: null, avgLevel: { $avg: "$currentLevel" } } },
                ]),
                Bin_1.Bin.aggregate([
                    {
                        $group: {
                            _id: "$binType",
                            count: { $sum: 1 },
                            totalFillLevel: { $sum: "$currentLevel" },
                        },
                    },
                ]),
                Collection_1.Collection.countDocuments({
                    actualDate: {
                        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                        $lt: new Date(new Date().setHours(23, 59, 59, 999)),
                    },
                    status: "completed",
                }),
            ]);
            const totalScheduledToday = await Collection_1.Collection.countDocuments({
                scheduledDate: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    $lt: new Date(new Date().setHours(23, 59, 59, 999)),
                },
            });
            const efficiency = totalScheduledToday > 0 ? collectionsToday / totalScheduledToday : 0;
            const wasteGenerated = {
                general: 0,
                recyclable: 0,
                organic: 0,
                hazardous: 0,
            };
            wasteByType.forEach((item) => {
                if (item._id && wasteGenerated.hasOwnProperty(item._id)) {
                    wasteGenerated[item._id] = item.count ?? 0;
                }
            });
            const metrics = {
                totalBins,
                activeBins,
                overflowingBins,
                maintenanceBins,
                inactiveBins,
                collectionsToday,
                avgFillLevel: avgFillLevel && avgFillLevel.length > 0 && avgFillLevel[0].avgLevel !== null && avgFillLevel[0].avgLevel !== undefined
                    ? Math.round(avgFillLevel[0].avgLevel * 10) / 10
                    : 0,
                efficiency: Math.round(efficiency * 100) / 100,
                wasteGenerated,
                timestamp: new Date(),
            };
            logger_1.logger.info("Metrics retrieved", {
                totalBins,
                activeBins,
                overflowingBins,
                collectionsToday,
                avgFillLevel: metrics.avgFillLevel,
                efficiency: metrics.efficiency,
                wasteGenerated,
            });
            response_1.ResponseHandler.success(res, metrics, "Metrics retrieved successfully");
        }
        catch (error) {
            logger_1.logger.error("Get metrics error:", { error });
            response_1.ResponseHandler.error(res, "Failed to get metrics");
        }
    }
    static async getPredictionMetrics(req, res) {
        try {
            const { startDate, endDate, binId } = req.query;
            const end = endDate ? new Date(endDate) : new Date();
            const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const predictionQuery = {
                createdAt: { $gte: start, $lte: end },
                horizonHours: 24,
            };
            if (binId) {
                predictionQuery.binId = binId;
            }
            const predictions = await Prediction_1.Prediction.find(predictionQuery)
                .sort({ createdAt: -1 })
                .lean();
            const mongoose = require('mongoose');
            const db = mongoose.connection.db;
            const binHistoryCollection = db?.collection('bin_history');
            const predictionsWithActuals = [];
            if (binHistoryCollection) {
                for (const pred of predictions) {
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
                        const actualLevel = actualEntry.fillLevel || actualEntry['fillLevel'] || 0;
                        predictionsWithActuals.push({
                            ...pred,
                            actualFillLevel24h: actualLevel,
                        });
                    }
                }
            }
            let mae = 0;
            let rmse = 0;
            let mape = 0;
            let totalError = 0;
            let totalSquaredError = 0;
            let totalPercentageError = 0;
            let count = 0;
            predictionsWithActuals.forEach((pred) => {
                const error = Math.abs(pred.predictedLevel - pred.actualFillLevel24h);
                const squaredError = Math.pow(error, 2);
                const percentageError = pred.actualFillLevel24h > 0
                    ? (error / pred.actualFillLevel24h) * 100
                    : 0;
                totalError += error;
                totalSquaredError += squaredError;
                totalPercentageError += percentageError;
                count++;
            });
            if (count === 0) {
                const { PredictionAccuracy } = await Promise.resolve().then(() => __importStar(require('../models/PredictionAccuracy')));
                const accuracyRecords = await PredictionAccuracy.find({
                    date: { $gte: start, $lte: end },
                    binId: binId || null,
                }).sort({ date: -1 }).lean();
                if (accuracyRecords.length > 0) {
                    const aggregateRecords = accuracyRecords.filter(r => !r.binId);
                    if (aggregateRecords.length > 0) {
                        const latest = aggregateRecords[0];
                        if (latest) {
                            mae = latest.mae || 0;
                            rmse = latest.rmse || 0;
                            mape = latest.mape || 0;
                            count = latest.sampleCount || 0;
                        }
                    }
                    else {
                        const totalMae = accuracyRecords.reduce((sum, r) => sum + (r.mae || 0) * (r.sampleCount || 0), 0);
                        const totalRmse = accuracyRecords.reduce((sum, r) => sum + (r.rmse || 0) * (r.sampleCount || 0), 0);
                        const totalMape = accuracyRecords.reduce((sum, r) => sum + (r.mape || 0) * (r.sampleCount || 0), 0);
                        const totalSamples = accuracyRecords.reduce((sum, r) => sum + (r.sampleCount || 0), 0);
                        if (totalSamples > 0) {
                            mae = totalMae / totalSamples;
                            rmse = totalRmse / totalSamples;
                            mape = totalMape / totalSamples;
                            count = totalSamples;
                        }
                    }
                }
            }
            else {
                if (count > 0) {
                    mae = totalError / count;
                    rmse = Math.sqrt(totalSquaredError / count);
                    mape = totalPercentageError / count;
                }
            }
            const mlPredictions = predictions.filter((p) => p.source === 'ml-service');
            const fallbackPredictions = predictions.filter((p) => p.source === 'fallback');
            const mlWithActuals = predictionsWithActuals.filter((p) => p.source === 'ml-service');
            const fallbackWithActuals = predictionsWithActuals.filter((p) => p.source === 'fallback');
            let mlMae = 0;
            let fallbackMae = 0;
            if (mlWithActuals.length > 0) {
                const mlTotalError = mlWithActuals.reduce((sum, p) => sum + Math.abs(p.predictedLevel - p.actualFillLevel24h), 0);
                mlMae = mlTotalError / mlWithActuals.length;
            }
            if (fallbackWithActuals.length > 0) {
                const fallbackTotalError = fallbackWithActuals.reduce((sum, p) => sum + Math.abs(p.predictedLevel - p.actualFillLevel24h), 0);
                fallbackMae = fallbackTotalError / fallbackWithActuals.length;
            }
            const confidenceRanges = {
                high: predictions.filter((p) => (p.confidence || 0) >= 0.8).length,
                medium: predictions.filter((p) => (p.confidence || 0) >= 0.6 && (p.confidence || 0) < 0.8).length,
                low: predictions.filter((p) => (p.confidence || 0) < 0.6).length,
            };
            const trendsByDay = {};
            predictionsWithActuals.forEach((pred) => {
                const dateKey = (0, date_fns_1.format)(new Date(pred.createdAt), 'yyyy-MM-dd');
                if (!trendsByDay[dateKey]) {
                    trendsByDay[dateKey] = { predicted: [], actual: [], date: dateKey };
                }
                trendsByDay[dateKey].predicted.push(pred.predictedLevel);
                trendsByDay[dateKey].actual.push(pred.actualFillLevel24h);
            });
            const trendData = Object.values(trendsByDay).map((day) => ({
                date: (0, date_fns_1.format)(new Date(day.date), 'MMM dd'),
                predicted: day.predicted.reduce((sum, val) => sum + val, 0) / day.predicted.length,
                actual: day.actual.reduce((sum, val) => sum + val, 0) / day.actual.length,
                count: day.predicted.length,
            })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const metrics = {
                accuracy: {
                    mae: parseFloat(mae.toFixed(2)),
                    rmse: parseFloat(rmse.toFixed(2)),
                    mape: parseFloat(mape.toFixed(2)),
                    sampleCount: count,
                },
                sourceBreakdown: {
                    ml: {
                        count: mlPredictions.length,
                        mae: parseFloat(mlMae.toFixed(2)),
                        accuracy: mlWithActuals.length > 0 ? parseFloat((100 - (mlMae / 100) * 100).toFixed(2)) : null,
                    },
                    fallback: {
                        count: fallbackPredictions.length,
                        mae: parseFloat(fallbackMae.toFixed(2)),
                        accuracy: fallbackWithActuals.length > 0 ? parseFloat((100 - (fallbackMae / 100) * 100).toFixed(2)) : null,
                    },
                },
                confidenceDistribution: confidenceRanges,
                trends: trendData,
                totalPredictions: predictions.length,
                predictionsWithActuals: predictionsWithActuals.length,
            };
            response_1.ResponseHandler.success(res, metrics, 'Prediction metrics retrieved successfully');
        }
        catch (error) {
            logger_1.logger.error('Get prediction metrics error:', error);
            response_1.ResponseHandler.error(res, 'Failed to get prediction metrics', 500);
        }
    }
    static async getPredictions(req, res) {
        try {
            const { binId, days = 7 } = req.query;
            if (binId) {
                const bin = await Bin_1.Bin.findOne({ binId: binId }).lean();
                if (!bin) {
                    response_1.ResponseHandler.error(res, "Bin not found", 404);
                    return;
                }
                const { MLClient } = await Promise.resolve().then(() => __importStar(require("../services/mlClient")));
                const mlClient = new MLClient();
                try {
                    const prediction = await mlClient.predictWaste(bin.binId, bin.binType, bin.currentLevel, bin.capacity, bin.location, parseInt(days) * 24);
                    await Prediction_1.Prediction.create({
                        binId: bin.binId,
                        horizonHours: parseInt(days) * 24,
                        predictedLevel: prediction.predicted_level,
                        timeToFullHours: prediction.time_to_full_hours ?? null,
                        riskLevel: prediction.risk_level,
                        recommendedCollectionTime: prediction.recommended_collection_time ? new Date(prediction.recommended_collection_time) : null,
                        confidence: prediction.confidence,
                        factors: prediction.factors ?? [],
                        source: 'ml-service',
                    });
                    response_1.ResponseHandler.success(res, prediction, "Prediction retrieved successfully");
                }
                catch (_mlError) {
                    const baseFillRate = AnalyticsController.getBaseFillRate(bin.binType);
                    const hoursToFull = (100 - bin.currentLevel) / baseFillRate;
                    const prediction = {
                        bin_id: bin.binId,
                        predicted_level: Math.min(100, bin.currentLevel + baseFillRate * 24),
                        confidence: 0.6,
                        time_to_full_hours: hoursToFull,
                        recommended_collection_time: new Date(Date.now() + hoursToFull * 3600000),
                        risk_level: bin.currentLevel >= 85
                            ? "high"
                            : bin.currentLevel >= 70
                                ? "medium"
                                : "low",
                        factors: ["Historical data limited", "Using fallback algorithm"],
                    };
                    await Prediction_1.Prediction.create({
                        binId: bin.binId,
                        horizonHours: parseInt(days) * 24,
                        predictedLevel: prediction.predicted_level,
                        timeToFullHours: prediction.time_to_full_hours ?? null,
                        riskLevel: prediction.risk_level,
                        recommendedCollectionTime: prediction.recommended_collection_time,
                        confidence: prediction.confidence,
                        factors: prediction.factors,
                        source: 'fallback',
                    });
                    response_1.ResponseHandler.success(res, prediction, "Prediction retrieved (fallback mode)");
                }
            }
            else {
                const bins = await Bin_1.Bin.find({ status: "active" }).limit(10).lean();
                const predictions = bins.map((bin) => {
                    const baseFillRate = AnalyticsController.getBaseFillRate(bin.binType);
                    const hoursToFull = (100 - bin.currentLevel) / baseFillRate;
                    return {
                        binId: bin.binId,
                        currentLevel: bin.currentLevel,
                        predictedLevel: Math.min(100, bin.currentLevel + baseFillRate * 24),
                        timeToFull: hoursToFull,
                        needsCollection: bin.currentLevel >= 70 || hoursToFull < 48,
                    };
                });
                try {
                    const bulk = predictions.map((p) => ({
                        insertOne: {
                            document: {
                                binId: p.binId,
                                horizonHours: 24,
                                predictedLevel: p.predictedLevel,
                                timeToFullHours: p.timeToFull,
                                riskLevel: p.predictedLevel >= 95 ? 'critical' : p.predictedLevel >= 85 ? 'high' : p.predictedLevel >= 70 ? 'medium' : 'low',
                                source: 'fallback',
                                createdAt: new Date(),
                            }
                        }
                    }));
                    if (bulk.length > 0) {
                        await Prediction_1.Prediction.bulkWrite(bulk).catch((bulkError) => {
                            logger_1.logger.warn('Bulk prediction write failed, continuing anyway:', bulkError);
                        });
                    }
                }
                catch (bulkError) {
                    logger_1.logger.warn('Prediction persistence failed, continuing anyway:', bulkError);
                }
                response_1.ResponseHandler.success(res, predictions, "Predictions retrieved successfully");
            }
        }
        catch (error) {
            logger_1.logger.error("Get predictions error:", error);
            if (error instanceof Error) {
                logger_1.logger.error("Error message:", error.message);
                logger_1.logger.error("Error stack:", error.stack);
            }
            response_1.ResponseHandler.error(res, "Failed to get predictions", 500);
        }
    }
    static async getDashboardData(_req, res) {
        try {
            const mongoose = require('mongoose');
            if (mongoose.connection.readyState !== 1) {
                logger_1.logger.warn('Dashboard data requested but database is not connected');
                response_1.ResponseHandler.success(res, {
                    stats: {
                        totalBins: 0,
                        activeBins: 0,
                        overflowingBins: 0,
                        maintenanceBins: 0,
                        collectionsToday: 0,
                        routesActive: 0,
                        alertsActive: 0,
                        systemHealth: 0,
                    },
                    recentActivity: [],
                    lastUpdated: new Date(),
                    databaseConnected: false,
                }, 'Dashboard data (database disconnected)');
                return;
            }
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const [totalBins, activeBins, overflowingBins, maintenanceBins, collectionsToday, routesActive, unresolvedAlerts, recentCollections, recentAlerts,] = await Promise.all([
                Bin_1.Bin.countDocuments(),
                Bin_1.Bin.countDocuments({ status: "active" }),
                Bin_1.Bin.countDocuments({ isOverflowing: true }),
                Bin_1.Bin.countDocuments({ status: "maintenance" }),
                Collection_1.Collection.countDocuments({
                    actualDate: { $gte: today, $lt: tomorrow },
                    status: "completed",
                }),
                Route_1.Route.countDocuments({ status: "active" }),
                Bin_1.Bin.aggregate([
                    { $unwind: "$alerts" },
                    { $match: { "alerts.resolved": false } },
                    { $count: "total" },
                ]),
                Collection_1.Collection.find({ status: "completed" })
                    .sort({ actualDate: -1 })
                    .limit(5)
                    .lean(),
                Bin_1.Bin.aggregate([
                    { $unwind: "$alerts" },
                    { $match: { "alerts.resolved": false } },
                    { $sort: { "alerts.timestamp": -1 } },
                    { $limit: 5 },
                ]),
            ]);
            const systemHealth = (activeBins / totalBins) *
                (1 - overflowingBins / totalBins) *
                (collectionsToday / Math.max(overflowingBins, 1));
            const dashboardData = {
                stats: {
                    totalBins,
                    activeBins,
                    overflowingBins,
                    maintenanceBins,
                    collectionsToday,
                    routesActive,
                    alertsActive: unresolvedAlerts[0]?.total || 0,
                    systemHealth: Math.min(1, Math.round(systemHealth * 100) / 100),
                },
                recentActivity: [
                    ...recentCollections.map((c) => ({
                        id: c._id,
                        type: "collection",
                        title: `Collection completed for ${c.bin?.binId || "bin"}`,
                        time: c.actualDate,
                        status: "success",
                    })),
                    ...recentAlerts.map((a) => ({
                        id: a._id,
                        type: "alert",
                        title: a.alerts?.message || "Alert",
                        time: a.alerts?.timestamp || new Date(),
                        status: a.alerts?.type === "overflow"
                            ? "error"
                            : "warning",
                    })),
                ]
                    .sort((a, b) => {
                    const aTime = a.time instanceof Date ? a.time : new Date(a.time || 0);
                    const bTime = b.time instanceof Date ? b.time : new Date(b.time || 0);
                    return bTime.getTime() - aTime.getTime();
                })
                    .slice(0, 10),
                lastUpdated: new Date(),
                databaseConnected: true,
            };
            logger_1.logger.info("Dashboard data retrieved", {
                totalBins,
                overflowingBins,
                collectionsToday,
            });
            response_1.ResponseHandler.success(res, dashboardData, "Dashboard data retrieved successfully");
        }
        catch (error) {
            logger_1.logger.error("Get dashboard data error:", { error });
            response_1.ResponseHandler.error(res, "Failed to get dashboard data");
        }
    }
    static async getBinStatusSummary(_req, res) {
        try {
            const [statusSummary, typeSummary, totalBins] = await Promise.all([
                Bin_1.Bin.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
                Bin_1.Bin.aggregate([
                    {
                        $group: {
                            _id: "$binType",
                            count: { $sum: 1 },
                            avgFillLevel: { $avg: "$currentLevel" },
                        },
                    },
                ]),
                Bin_1.Bin.countDocuments(),
            ]);
            const byStatus = {
                active: 0,
                maintenance: 0,
                inactive: 0,
                full: 0,
            };
            statusSummary.forEach((item) => {
                byStatus[item._id] = item.count ?? 0;
            });
            const byType = {
                general: { count: 0, avgFillLevel: 0 },
                recyclable: { count: 0, avgFillLevel: 0 },
                organic: { count: 0, avgFillLevel: 0 },
                hazardous: { count: 0, avgFillLevel: 0 },
            };
            typeSummary.forEach((item) => {
                byType[item._id] = {
                    count: item.count ?? 0,
                    avgFillLevel: Math.round((item.avgFillLevel ?? 0) * 10) / 10,
                };
            });
            const overflowing = await Bin_1.Bin.countDocuments({ isOverflowing: true });
            const binStatus = {
                total: totalBins,
                byStatus,
                byType,
                overflowing,
            };
            response_1.ResponseHandler.success(res, binStatus, "Bin status summary retrieved successfully");
        }
        catch (error) {
            logger_1.logger.error("Get bin status summary error:", { error });
            response_1.ResponseHandler.error(res, "Failed to get bin status summary");
        }
    }
    static async getCollectionSummary(req, res) {
        try {
            const { startDate, endDate } = req.query;
            const dateFilter = {};
            if (startDate || endDate) {
                dateFilter.actualDate = {};
                if (startDate)
                    dateFilter.actualDate.$gte = new Date(startDate);
                if (endDate)
                    dateFilter.actualDate.$lte = new Date(endDate);
            }
            const [totalCollections, completedCollections, pendingCollections, cancelledCollections, weightStats, dailyCollections,] = await Promise.all([
                Collection_1.Collection.countDocuments(dateFilter.actualDate ? { actualDate: dateFilter.actualDate } : {}),
                Collection_1.Collection.countDocuments({
                    status: "completed",
                    ...(dateFilter.actualDate && { actualDate: dateFilter.actualDate }),
                }),
                Collection_1.Collection.countDocuments({
                    status: { $in: ["scheduled", "in_progress"] },
                }),
                Collection_1.Collection.countDocuments({ status: "cancelled" }),
                Collection_1.Collection.aggregate([
                    { $match: { status: "completed", weight: { $exists: true } } },
                    {
                        $group: {
                            _id: null,
                            avgWeight: { $avg: "$weight" },
                            totalWeight: { $sum: "$weight" },
                            avgVolume: { $avg: "$volume" },
                        },
                    },
                ]),
                Collection_1.Collection.aggregate([
                    { $match: { status: "completed" } },
                    {
                        $group: {
                            _id: {
                                $dateToString: { format: "%Y-%m-%d", date: "$actualDate" },
                            },
                            count: { $sum: 1 },
                        },
                    },
                    { $sort: { _id: -1 } },
                    { $limit: 30 },
                ]),
            ]);
            const efficiency = totalCollections > 0 ? completedCollections / totalCollections : 0;
            const collectionSummary = {
                totalCollections,
                completed: completedCollections,
                pending: pendingCollections,
                cancelled: cancelledCollections,
                avgWeight: weightStats[0]?.avgWeight || 0,
                totalWeight: weightStats[0]?.totalWeight || 0,
                avgVolume: weightStats[0]?.avgVolume || 0,
                efficiency: Math.round(efficiency * 100) / 100,
                dailyTrend: dailyCollections,
            };
            logger_1.logger.info("Collection summary retrieved", {
                total: totalCollections,
                completed: completedCollections,
            });
            response_1.ResponseHandler.success(res, collectionSummary, "Collection summary retrieved successfully");
        }
        catch (error) {
            logger_1.logger.error("Get collection summary error:", { error });
            response_1.ResponseHandler.error(res, "Failed to get collection summary");
        }
    }
    static async getRoutePerformance(_req, res) {
        try {
            const [totalRoutes, completedRoutes, activeRoutes, performanceStats] = await Promise.all([
                Route_1.Route.countDocuments(),
                Route_1.Route.countDocuments({ status: "completed" }),
                Route_1.Route.countDocuments({ status: "active" }),
                Route_1.Route.aggregate([
                    {
                        $match: {
                            status: "completed",
                            actualDuration: { $exists: true },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            avgDuration: { $avg: "$actualDuration" },
                            avgDistance: { $avg: "$totalDistance" },
                            totalDistance: { $sum: "$totalDistance" },
                            avgEfficiency: { $avg: "$optimizationData.efficiency" },
                        },
                    },
                ]),
            ]);
            const overdueRoutes = await Route_1.Route.countDocuments({
                status: "active",
                scheduledDate: { $lt: new Date() },
            });
            const onTimePercentage = totalRoutes > 0 ? (totalRoutes - overdueRoutes) / totalRoutes : 1;
            const totalDistance = performanceStats[0]?.totalDistance || 0;
            const fuelConsumption = (totalDistance / 100) * 10;
            const co2Saved = fuelConsumption * 0.2 * 2.3;
            const routePerformance = {
                totalRoutes,
                completedRoutes,
                activeRoutes,
                avgDuration: performanceStats[0]?.avgDuration || 0,
                avgDistance: performanceStats[0]?.avgDistance || 0,
                totalDistance: performanceStats[0]?.totalDistance || 0,
                efficiency: performanceStats[0]?.avgEfficiency || 0,
                onTimePercentage: Math.round(onTimePercentage * 100) / 100,
                fuelConsumption: Math.round(fuelConsumption * 10) / 10,
                co2Saved: Math.round(co2Saved * 10) / 10,
            };
            logger_1.logger.info("Route performance retrieved", {
                totalRoutes,
                completedRoutes,
            });
            response_1.ResponseHandler.success(res, routePerformance, "Route performance retrieved successfully");
        }
        catch (error) {
            logger_1.logger.error("Get route performance error:", { error });
            response_1.ResponseHandler.error(res, "Failed to get route performance");
        }
    }
    static async getAlertSummary(_req, res) {
        try {
            const [allAlerts, activeAlerts, resolvedToday] = await Promise.all([
                Bin_1.Bin.aggregate([
                    { $unwind: "$alerts" },
                    {
                        $group: {
                            _id: "$alerts.type",
                            count: { $sum: 1 },
                        },
                    },
                ]),
                Bin_1.Bin.aggregate([
                    { $unwind: "$alerts" },
                    { $match: { "alerts.resolved": false } },
                    {
                        $group: {
                            _id: "$alerts.type",
                            count: { $sum: 1 },
                        },
                    },
                ]),
                Bin_1.Bin.aggregate([
                    { $unwind: "$alerts" },
                    {
                        $match: {
                            "alerts.resolved": true,
                            "alerts.timestamp": {
                                $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                            },
                        },
                    },
                    { $count: "total" },
                ]),
            ]);
            const byType = {
                overflow: 0,
                maintenance: 0,
                offline: 0,
                full: 0,
            };
            activeAlerts.forEach((item) => {
                byType[item._id] = item.count ?? 0;
            });
            const totalActive = activeAlerts.reduce((sum, item) => sum + (item.count ?? 0), 0);
            const totalAll = allAlerts.reduce((sum, item) => sum + (item.count ?? 0), 0);
            const bySeverity = {
                low: byType.maintenance || 0,
                medium: byType.offline || 0,
                high: byType.full || 0,
                critical: byType.overflow || 0,
            };
            const alertSummary = {
                totalAlerts: totalAll,
                activeAlerts: totalActive,
                resolvedToday: resolvedToday[0]?.total || 0,
                byType,
                bySeverity,
            };
            logger_1.logger.info("Alert summary retrieved", {
                totalActive,
                resolvedToday: resolvedToday[0]?.total || 0,
            });
            response_1.ResponseHandler.success(res, alertSummary, "Alert summary retrieved successfully");
        }
        catch (error) {
            logger_1.logger.error("Get alert summary error:", { error });
            response_1.ResponseHandler.error(res, "Failed to get alert summary");
        }
    }
    static getBaseFillRate(binType) {
        const rates = {
            general: 2.5,
            recyclable: 1.8,
            organic: 3.2,
            hazardous: 0.8,
        };
        return rates[binType] || 2.0;
    }
}
exports.AnalyticsController = AnalyticsController;
//# sourceMappingURL=analyticsController.js.map