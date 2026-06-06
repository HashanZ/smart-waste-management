import { Request, Response } from "express";
import { ResponseHandler } from "@/utils/response";
import { logger } from "@/utils/logger";
import { Bin } from "@/models/Bin";
import { Collection } from "@/models/Collection";
import { Route } from "@/models/Route";
import { Prediction } from "@/models/Prediction";
import { format } from "date-fns";

export class AnalyticsController {
  static async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, binType } = req.query;

      // Build date filter
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (startDate) dateFilter.$gte = new Date(startDate as string);
      if (endDate) dateFilter.$lte = new Date(endDate as string);

      // Build bin type filter
      const binTypeFilter: { binType?: string } = {};
      if (binType) binTypeFilter.binType = String(binType);

      // Aggregate metrics
      const [
        totalBins,
        activeBins,
        overflowingBins,
        maintenanceBins,
        inactiveBins,
        avgFillLevel,
        wasteByType,
        collectionsToday,
      ] = await Promise.all([
        Bin.countDocuments(),
        Bin.countDocuments({ status: "active" }),
        Bin.countDocuments({ isOverflowing: true }),
        Bin.countDocuments({ status: "maintenance" }),
        Bin.countDocuments({ status: "inactive" }),
        Bin.aggregate([
          { $match: { currentLevel: { $exists: true, $ne: null } } },
          { $group: { _id: null, avgLevel: { $avg: "$currentLevel" } } },
        ]),
        Bin.aggregate([
          {
            $group: {
              _id: "$binType",
              count: { $sum: 1 },
              totalFillLevel: { $sum: "$currentLevel" },
            },
          },
        ]),
        Collection.countDocuments({
          actualDate: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
          status: "completed",
        }),
      ]);

      // Calculate efficiency (completed collections / total scheduled)
      const totalScheduledToday = await Collection.countDocuments({
        scheduledDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      });

      const efficiency =
        totalScheduledToday > 0 ? collectionsToday / totalScheduledToday : 0;

      // Format waste by type - use count instead of totalFillLevel for better representation
      const wasteGenerated: Record<
        "general" | "recyclable" | "organic" | "hazardous",
        number
      > = {
        general: 0,
        recyclable: 0,
        organic: 0,
        hazardous: 0,
      };

      (
        wasteByType as Array<{
          _id: "general" | "recyclable" | "organic" | "hazardous";
          count: number;
          totalFillLevel: number;
        }>
      ).forEach((item) => {
        // Use count of bins as a proxy for waste generated
        // In a real system, this would come from collection data
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

      logger.info("Metrics retrieved", {
        totalBins,
        activeBins,
        overflowingBins,
        collectionsToday,
        avgFillLevel: metrics.avgFillLevel,
        efficiency: metrics.efficiency,
        wasteGenerated,
      });

      ResponseHandler.success(res, metrics, "Metrics retrieved successfully");
    } catch (error: unknown) {
      logger.error("Get metrics error:", { error });
      ResponseHandler.error(res, "Failed to get metrics");
    }
  }

  static async getPredictionMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, binId } = req.query;

      // Default to last 30 days if no date range provided
      const end = endDate ? new Date(endDate as string) : new Date();
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Build query for predictions
      const predictionQuery: any = {
        createdAt: { $gte: start, $lte: end },
        horizonHours: 24, // Focus on 24h predictions
      };

      if (binId) {
        predictionQuery.binId = binId as string;
      }

      // Get predictions
      const predictions = await Prediction.find(predictionQuery)
        .sort({ createdAt: -1 })
        .lean();

      // Get actual values from bin_history for predictions made 24h ago
      const mongoose = require('mongoose');
      const db = mongoose.connection.db;
      const binHistoryCollection = db?.collection('bin_history');

      // Match predictions with actual values from bin_history
      const predictionsWithActuals: any[] = [];

      if (binHistoryCollection) {
        for (const pred of predictions) {
          // Find actual value 24h after prediction was made
          const predictionTime = new Date(pred.createdAt);
          const actualTime = new Date(predictionTime.getTime() + 24 * 60 * 60 * 1000);

          const actualEntry = await binHistoryCollection.findOne({
            binId: pred.binId,
            timestamp: {
              $gte: new Date(actualTime.getTime() - 2 * 60 * 60 * 1000), // 2 hour window
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

      // Calculate accuracy metrics
      let mae = 0; // Mean Absolute Error
      let rmse = 0; // Root Mean Squared Error
      let mape = 0; // Mean Absolute Percentage Error
      let totalError = 0;
      let totalSquaredError = 0;
      let totalPercentageError = 0;
      let count = 0;

      predictionsWithActuals.forEach((pred: any) => {
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

      // If no predictions with actuals, try to use PredictionAccuracy records
      if (count === 0) {
        const { PredictionAccuracy } = await import('@/models/PredictionAccuracy');
        const accuracyRecords = await PredictionAccuracy.find({
          date: { $gte: start, $lte: end },
          binId: binId || null,
        }).sort({ date: -1 }).lean();

        if (accuracyRecords.length > 0) {
          // Aggregate accuracy records
          const aggregateRecords = accuracyRecords.filter(r => !r.binId);
          if (aggregateRecords.length > 0) {
            // Use the most recent aggregate record
            const latest = aggregateRecords[0];
            if (latest) {
              mae = latest.mae || 0;
              rmse = latest.rmse || 0;
              mape = latest.mape || 0;
              count = latest.sampleCount || 0;
            }
          } else {
            // Calculate average from all records
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
      } else {
        if (count > 0) {
          mae = totalError / count;
          rmse = Math.sqrt(totalSquaredError / count);
          mape = totalPercentageError / count;
        }
      }

      // ML vs Fallback breakdown
      const mlPredictions = predictions.filter((p: any) => p.source === 'ml-service');
      const fallbackPredictions = predictions.filter((p: any) => p.source === 'fallback');

      // Calculate accuracy by source
      const mlWithActuals = predictionsWithActuals.filter((p: any) => p.source === 'ml-service');
      const fallbackWithActuals = predictionsWithActuals.filter((p: any) => p.source === 'fallback');

      let mlMae = 0;
      let fallbackMae = 0;

      if (mlWithActuals.length > 0) {
        const mlTotalError = mlWithActuals.reduce((sum: number, p: any) =>
          sum + Math.abs(p.predictedLevel - p.actualFillLevel24h), 0
        );
        mlMae = mlTotalError / mlWithActuals.length;
      }

      if (fallbackWithActuals.length > 0) {
        const fallbackTotalError = fallbackWithActuals.reduce((sum: number, p: any) =>
          sum + Math.abs(p.predictedLevel - p.actualFillLevel24h), 0
        );
        fallbackMae = fallbackTotalError / fallbackWithActuals.length;
      }

      // Confidence distribution
      const confidenceRanges = {
        high: predictions.filter((p: any) => (p.confidence || 0) >= 0.8).length,
        medium: predictions.filter((p: any) => (p.confidence || 0) >= 0.6 && (p.confidence || 0) < 0.8).length,
        low: predictions.filter((p: any) => (p.confidence || 0) < 0.6).length,
      };

      // Prediction trends over time (grouped by day)
      const trendsByDay: { [key: string]: { predicted: number[]; actual: number[]; date: string } } = {};

      predictionsWithActuals.forEach((pred: any) => {
        const dateKey = format(new Date(pred.createdAt), 'yyyy-MM-dd');
        if (!trendsByDay[dateKey]) {
          trendsByDay[dateKey] = { predicted: [], actual: [], date: dateKey };
        }
        trendsByDay[dateKey].predicted.push(pred.predictedLevel);
        trendsByDay[dateKey].actual.push(pred.actualFillLevel24h);
      });

      const trendData = Object.values(trendsByDay).map((day) => ({
        date: format(new Date(day.date), 'MMM dd'),
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

      ResponseHandler.success(res, metrics, 'Prediction metrics retrieved successfully');
    } catch (error: unknown) {
      logger.error('Get prediction metrics error:', error);
      ResponseHandler.error(res, 'Failed to get prediction metrics', 500);
    }
  }

  static async getPredictions(req: Request, res: Response): Promise<void> {
    try {
      const { binId, days = 7 } = req.query;

      if (binId) {
        // Get prediction for specific bin
        const bin = await Bin.findOne({ binId: binId as string }).lean();
        if (!bin) {
          ResponseHandler.error(res, "Bin not found", 404);
          return;
        }

        // Call ML service for prediction
        const { MLClient } = await import("@/services/mlClient");
        const mlClient = new MLClient();

        try {
          const prediction = await mlClient.predictWaste(
            bin.binId,
            bin.binType,
            bin.currentLevel,
            bin.capacity,
            bin.location,
            parseInt(days as string) * 24, // Convert days to hours
          );
          // persist prediction
          await Prediction.create({
            binId: bin.binId,
            horizonHours: parseInt(days as string) * 24,
            predictedLevel: prediction.predicted_level,
            timeToFullHours: prediction.time_to_full_hours ?? null,
            riskLevel: prediction.risk_level as 'low' | 'medium' | 'high' | 'critical',
            recommendedCollectionTime: prediction.recommended_collection_time ? new Date(prediction.recommended_collection_time) : null,
            confidence: prediction.confidence,
            factors: prediction.factors ?? [],
            source: 'ml-service',
          });

          ResponseHandler.success(
            res,
            prediction,
            "Prediction retrieved successfully",
          );
        } catch (_mlError: unknown) {
          // Fallback to simple prediction
          const baseFillRate = AnalyticsController.getBaseFillRate(bin.binType);
          const hoursToFull = (100 - bin.currentLevel) / baseFillRate;

          const prediction = {
            bin_id: bin.binId,
            predicted_level: Math.min(
              100,
              bin.currentLevel + baseFillRate * 24,
            ),
            confidence: 0.6,
            time_to_full_hours: hoursToFull,
            recommended_collection_time: new Date(
              Date.now() + hoursToFull * 3600000,
            ),
            risk_level:
              bin.currentLevel >= 85
                ? "high"
                : bin.currentLevel >= 70
                  ? "medium"
                  : "low",
            factors: ["Historical data limited", "Using fallback algorithm"],
          };

          // persist fallback prediction
          await Prediction.create({
            binId: bin.binId,
            horizonHours: parseInt(days as string) * 24,
            predictedLevel: prediction.predicted_level,
            timeToFullHours: prediction.time_to_full_hours ?? null,
            riskLevel: prediction.risk_level as 'low' | 'medium' | 'high' | 'critical',
            recommendedCollectionTime: prediction.recommended_collection_time as Date,
            confidence: prediction.confidence,
            factors: prediction.factors,
            source: 'fallback',
          });

          ResponseHandler.success(
            res,
            prediction,
            "Prediction retrieved (fallback mode)",
          );
        }
      } else {
        // Get predictions for all bins
        const bins = await Bin.find({ status: "active" }).limit(10).lean();

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

        // persist generated simple predictions (24h horizon)
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
            await Prediction.bulkWrite(bulk).catch((bulkError) => {
              logger.warn('Bulk prediction write failed, continuing anyway:', bulkError);
            });
          }
        } catch (bulkError) {
          logger.warn('Prediction persistence failed, continuing anyway:', bulkError);
        }

        ResponseHandler.success(
          res,
          predictions,
          "Predictions retrieved successfully",
        );
      }
    } catch (error: unknown) {
      logger.error("Get predictions error:", error);
      if (error instanceof Error) {
        logger.error("Error message:", error.message);
        logger.error("Error stack:", error.stack);
      }
      ResponseHandler.error(res, "Failed to get predictions", 500);
    }
  }

  static async getDashboardData(_req: Request, res: Response): Promise<void> {
    try {
      // Check if database is connected
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) {
        logger.warn('Dashboard data requested but database is not connected');
        ResponseHandler.success(res, {
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

      // Aggregate data in parallel
      const [
        totalBins,
        activeBins,
        overflowingBins,
        maintenanceBins,
        collectionsToday,
        routesActive,
        unresolvedAlerts,
        recentCollections,
        recentAlerts,
      ] = await Promise.all([
        Bin.countDocuments(),
        Bin.countDocuments({ status: "active" }),
        Bin.countDocuments({ isOverflowing: true }),
        Bin.countDocuments({ status: "maintenance" }),
        Collection.countDocuments({
          actualDate: { $gte: today, $lt: tomorrow },
          status: "completed",
        }),
        Route.countDocuments({ status: "active" }),
        Bin.aggregate([
          { $unwind: "$alerts" },
          { $match: { "alerts.resolved": false } },
          { $count: "total" },
        ]),
        Collection.find({ status: "completed" })
          .sort({ actualDate: -1 })
          .limit(5)
          .lean(),
        Bin.aggregate([
          { $unwind: "$alerts" },
          { $match: { "alerts.resolved": false } },
          { $sort: { "alerts.timestamp": -1 } },
          { $limit: 5 },
        ]),
      ]);

      // Calculate system health (simple metric)
      const systemHealth =
        (activeBins / totalBins) *
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
            type: "collection" as const,
            title: `Collection completed for ${c.bin?.binId || "bin"}`,
            time: c.actualDate,
            status: "success" as const,
          })),
          ...recentAlerts.map(
            (a: {
              _id: string;
              alerts: { message?: string; timestamp?: Date; type?: string };
            }) => ({
              id: a._id,
              type: "alert" as const,
              title: a.alerts?.message || "Alert",
              time: a.alerts?.timestamp || new Date(),
              status:
                a.alerts?.type === "overflow"
                  ? ("error" as const)
                  : ("warning" as const),
            }),
          ),
        ]
          .sort(
            (a, b) => {
              const aTime = a.time instanceof Date ? a.time : new Date(a.time || 0);
              const bTime = b.time instanceof Date ? b.time : new Date(b.time || 0);
              return bTime.getTime() - aTime.getTime();
            },
          )
          .slice(0, 10),
        lastUpdated: new Date(),
        databaseConnected: true,
      };

      logger.info("Dashboard data retrieved", {
        totalBins,
        overflowingBins,
        collectionsToday,
      });

      ResponseHandler.success(
        res,
        dashboardData,
        "Dashboard data retrieved successfully",
      );
    } catch (error: unknown) {
      logger.error("Get dashboard data error:", { error });
      ResponseHandler.error(res, "Failed to get dashboard data");
    }
  }

  static async getBinStatusSummary(
    _req: Request,
    res: Response,
  ): Promise<void> {
    try {
      // Aggregate bins by status and type
      const [statusSummary, typeSummary, totalBins] = await Promise.all([
        Bin.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Bin.aggregate([
          {
            $group: {
              _id: "$binType",
              count: { $sum: 1 },
              avgFillLevel: { $avg: "$currentLevel" },
            },
          },
        ]),
        Bin.countDocuments(),
      ]);

      // Format status summary
      const byStatus: Record<
        "active" | "maintenance" | "inactive" | "full",
        number
      > = {
        active: 0,
        maintenance: 0,
        inactive: 0,
        full: 0,
      };
      (
        statusSummary as Array<{
          _id: "active" | "maintenance" | "inactive" | "full";
          count: number;
        }>
      ).forEach((item) => {
        byStatus[item._id] = item.count ?? 0;
      });

      // Format type summary
      const byType: Record<
        "general" | "recyclable" | "organic" | "hazardous",
        { count: number; avgFillLevel: number }
      > = {
        general: { count: 0, avgFillLevel: 0 },
        recyclable: { count: 0, avgFillLevel: 0 },
        organic: { count: 0, avgFillLevel: 0 },
        hazardous: { count: 0, avgFillLevel: 0 },
      };
      (
        typeSummary as Array<{
          _id: "general" | "recyclable" | "organic" | "hazardous";
          count: number;
          avgFillLevel: number;
        }>
      ).forEach((item) => {
        byType[item._id] = {
          count: item.count ?? 0,
          avgFillLevel: Math.round((item.avgFillLevel ?? 0) * 10) / 10,
        };
      });

      // Count overflowing bins
      const overflowing = await Bin.countDocuments({ isOverflowing: true });

      const binStatus = {
        total: totalBins,
        byStatus,
        byType,
        overflowing,
      };

      ResponseHandler.success(
        res,
        binStatus,
        "Bin status summary retrieved successfully",
      );
    } catch (error: unknown) {
      logger.error("Get bin status summary error:", { error });
      ResponseHandler.error(res, "Failed to get bin status summary");
    }
  }

  static async getCollectionSummary(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      const dateFilter: { actualDate?: { $gte?: Date; $lte?: Date } } = {};
      if (startDate || endDate) {
        dateFilter.actualDate = {};
        if (startDate)
          dateFilter.actualDate.$gte = new Date(startDate as string);
        if (endDate) dateFilter.actualDate.$lte = new Date(endDate as string);
      }

      // Aggregate collection data
      const [
        totalCollections,
        completedCollections,
        pendingCollections,
        cancelledCollections,
        weightStats,
        dailyCollections,
      ] = await Promise.all([
        Collection.countDocuments(
          dateFilter.actualDate ? { actualDate: dateFilter.actualDate } : {},
        ),
        Collection.countDocuments({
          status: "completed",
          ...(dateFilter.actualDate && { actualDate: dateFilter.actualDate }),
        }),
        Collection.countDocuments({
          status: { $in: ["scheduled", "in_progress"] },
        }),
        Collection.countDocuments({ status: "cancelled" }),
        Collection.aggregate([
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
        Collection.aggregate([
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

      const efficiency =
        totalCollections > 0 ? completedCollections / totalCollections : 0;

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

      logger.info("Collection summary retrieved", {
        total: totalCollections,
        completed: completedCollections,
      });

      ResponseHandler.success(
        res,
        collectionSummary,
        "Collection summary retrieved successfully",
      );
    } catch (error: unknown) {
      logger.error("Get collection summary error:", { error });
      ResponseHandler.error(res, "Failed to get collection summary");
    }
  }

  static async getRoutePerformance(
    _req: Request,
    res: Response,
  ): Promise<void> {
    try {
      // Aggregate route performance metrics
      const [totalRoutes, completedRoutes, activeRoutes, performanceStats] =
        await Promise.all([
          Route.countDocuments(),
          Route.countDocuments({ status: "completed" }),
          Route.countDocuments({ status: "active" }),
          Route.aggregate([
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

      // Calculate on-time percentage
      const overdueRoutes = await Route.countDocuments({
        status: "active",
        scheduledDate: { $lt: new Date() },
      });

      const onTimePercentage =
        totalRoutes > 0 ? (totalRoutes - overdueRoutes) / totalRoutes : 1;

      // Estimate fuel consumption (10L per 100km)
      const totalDistance = performanceStats[0]?.totalDistance || 0;
      const fuelConsumption = (totalDistance / 100) * 10;

      // Estimate CO2 saved (2.3kg CO2 per liter of fuel vs unoptimized)
      const co2Saved = fuelConsumption * 0.2 * 2.3; // Assuming 20% optimization

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

      logger.info("Route performance retrieved", {
        totalRoutes,
        completedRoutes,
      });

      ResponseHandler.success(
        res,
        routePerformance,
        "Route performance retrieved successfully",
      );
    } catch (error: unknown) {
      logger.error("Get route performance error:", { error });
      ResponseHandler.error(res, "Failed to get route performance");
    }
  }

  static async getAlertSummary(_req: Request, res: Response): Promise<void> {
    try {
      // Aggregate alerts from bins
      const [allAlerts, activeAlerts, resolvedToday] = await Promise.all([
        Bin.aggregate([
          { $unwind: "$alerts" },
          {
            $group: {
              _id: "$alerts.type",
              count: { $sum: 1 },
            },
          },
        ]),
        Bin.aggregate([
          { $unwind: "$alerts" },
          { $match: { "alerts.resolved": false } },
          {
            $group: {
              _id: "$alerts.type",
              count: { $sum: 1 },
            },
          },
        ]),
        Bin.aggregate([
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

      // Format by type
      const byType: Record<
        "overflow" | "maintenance" | "offline" | "full",
        number
      > = {
        overflow: 0,
        maintenance: 0,
        offline: 0,
        full: 0,
      };

      (
        activeAlerts as Array<{
          _id: "overflow" | "maintenance" | "offline" | "full";
          count: number;
        }>
      ).forEach((item) => {
        byType[item._id] = item.count ?? 0;
      });

      const totalActive = (activeAlerts as Array<{ count: number }>).reduce(
        (sum, item) => sum + (item.count ?? 0),
        0,
      );
      const totalAll = (allAlerts as Array<{ count: number }>).reduce(
        (sum, item) => sum + (item.count ?? 0),
        0,
      );

      // Classify by severity (based on alert type and age)
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

      logger.info("Alert summary retrieved", {
        totalActive,
        resolvedToday: resolvedToday[0]?.total || 0,
      });

      ResponseHandler.success(
        res,
        alertSummary,
        "Alert summary retrieved successfully",
      );
    } catch (error: unknown) {
      logger.error("Get alert summary error:", { error });
      ResponseHandler.error(res, "Failed to get alert summary");
    }
  }

  // Helper method to get base fill rate by bin type
  private static getBaseFillRate(binType: string): number {
    const rates: Record<string, number> = {
      general: 2.5,
      recyclable: 1.8,
      organic: 3.2,
      hazardous: 0.8,
    };
    return rates[binType] || 2.0;
  }
}
