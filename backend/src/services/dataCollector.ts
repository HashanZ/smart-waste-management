import { Bin } from "@/models/Bin";
import { Prediction } from "@/models/Prediction";
import { PredictionAccuracy } from "@/models/PredictionAccuracy";
import { logger } from "@/utils/logger";
import mongoose from "mongoose";

interface BinHistoryEntry {
  binId: string;
  timestamp: Date;
  fillLevel: number;
  binType: string;
  location: {
    latitude: number;
    longitude: number;
  };
  temperature?: number;
  dayOfWeek: number;
  hourOfDay: number;
  wasCollected: boolean;
  actualFillLevel24h?: number; // For training labels
}

export class DataCollector {
  private static collectionInterval: NodeJS.Timeout | null = null;

  /**
   * Start collecting historical data every hour
   */
  static start(): void {
    // Collect data every hour at minute 0
    this.collectionInterval = setInterval(
      async () => {
        await this.collectBinData();
      },
      60 * 60 * 1000,
    ); // Every hour

    // Also collect immediately
    this.collectBinData();

    logger.info("DataCollector started: collecting bin data every hour");
  }

  /**
   * Stop data collection
   */
  static stop(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
      logger.info("DataCollector stopped");
    }
  }

  /**
   * Collect current bin data and store in history
   */
  static async collectBinData(): Promise<void> {
    try {
      const bins = await Bin.find({ status: "active" }).lean();
      const now = new Date();

      if (bins.length === 0) {
        logger.warn("No active bins found for data collection");
        return;
      }

      let accuracyUpdatesCount = 0;

      for (const bin of bins) {
        // Store current state
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
          wasCollected: false, // Will be updated if collection detected
        });

        // Check if bin was collected (fill level dropped significantly)
        await this.detectCollection(bin.binId, bin.currentLevel || 0);

        // Update 24h predictions if we have historical data
        // This also tracks prediction accuracy
        const hadAccuracyUpdate = await this.update24hPredictions(bin.binId);
        if (hadAccuracyUpdate) {
          accuracyUpdatesCount++;
        }
      }

      logger.info(`Collected data for ${bins.length} bin(s)`);
      if (accuracyUpdatesCount > 0) {
        logger.debug(`Updated prediction accuracy for ${accuracyUpdatesCount} bin(s)`);
      }
    } catch (error) {
      logger.error("Data collection error", { error });
    }
  }

  /**
   * Detect if bin was collected (fill level dropped significantly)
   */
  private static async detectCollection(
    binId: string,
    currentLevel: number,
  ): Promise<void> {
    const db = mongoose.connection.db;
    if (!db) return;

    const collection = db.collection("bin_history");

    // Get last recorded level
    const lastEntry = await collection.findOne(
      { binId },
      { sort: { timestamp: -1 } },
    );

    if (lastEntry && (lastEntry["fillLevel"] as number) > currentLevel + 30) {
      // Significant drop indicates collection
      await collection.updateOne(
        { binId, timestamp: lastEntry["timestamp"] },
        { $set: { wasCollected: true } },
      );
      logger.info(`Detected collection for bin ${binId}`);
    }
  }

  /**
   * Store bin history in MongoDB
   */
  private static async storeBinHistory(entry: BinHistoryEntry): Promise<void> {
    const db = mongoose.connection.db;
    if (!db) return;

    try {
      const collection = db.collection("bin_history");
      await collection.insertOne(entry);
    } catch (error) {
      logger.error("Failed to store bin history", {
        error,
        binId: entry.binId,
      });
    }
  }

  /**
   * Update 24-hour predictions with actual values
   * @returns true if accuracy was updated, false otherwise
   */
  private static async update24hPredictions(binId: string): Promise<boolean> {
    const db = mongoose.connection.db;
    if (!db) return false;

    const collection = db.collection("bin_history");
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find prediction made 24h ago
    const oldEntry = await collection.findOne({
      binId,
      timestamp: {
        $gte: oneDayAgo,
        $lte: new Date(oneDayAgo.getTime() + 60 * 60 * 1000),
      },
    });

    if (oldEntry) {
      // Get current fill level
      const bin = await Bin.findOne({ binId }).lean();
      if (bin) {
        // Update with actual value for training
        await collection.updateOne(
          { _id: oldEntry._id },
          { $set: { actualFillLevel24h: bin.currentLevel || 0 } },
        );
      }
    }

    // Track prediction accuracy for this bin
    // Check if there are predictions to update before logging
    const now = new Date();
    const oneDayAgoStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    oneDayAgoStart.setHours(0, 0, 0, 0);
    const oneDayAgoEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    oneDayAgoEnd.setHours(23, 59, 59, 999);

    const predictionCount = await Prediction.countDocuments({
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

  /**
   * Update prediction accuracy metrics
   * Compares predictions from 24 hours ago with actual fill levels now
   */
  private static async updatePredictionAccuracy(binId?: string): Promise<void> {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneDayAgoStart = new Date(oneDayAgo);
      oneDayAgoStart.setHours(0, 0, 0, 0);
      const oneDayAgoEnd = new Date(oneDayAgo);
      oneDayAgoEnd.setHours(23, 59, 59, 999);

      // Build query for predictions made 24 hours ago
      const predictionQuery: any = {
        createdAt: {
          $gte: oneDayAgoStart,
          $lte: oneDayAgoEnd,
        },
        horizonHours: 24, // Focus on 24h predictions
      };

      if (binId) {
        predictionQuery.binId = binId;
      }

      // Get predictions from 24 hours ago
      const predictions = await Prediction.find(predictionQuery)
        .sort({ createdAt: -1 })
        .lean();

      if (predictions.length === 0) {
        logger.debug('No predictions found for accuracy tracking', { binId, date: oneDayAgo });
        return;
      }

      // Get actual fill levels from bin_history or current bin state
      const db = mongoose.connection.db;
      if (!db) return;

      const binHistoryCollection = db.collection("bin_history");
      const accuracyData: Array<{
        predicted: number;
        actual: number;
        source: string;
      }> = [];

      for (const pred of predictions) {
        // Find actual value 24h after prediction was made
        const predictionTime = new Date(pred.createdAt);
        const actualTime = new Date(predictionTime.getTime() + 24 * 60 * 60 * 1000);

        // Try to get from bin_history first
        const actualEntry = await binHistoryCollection.findOne({
          binId: pred.binId,
          timestamp: {
            $gte: new Date(actualTime.getTime() - 60 * 60 * 1000), // 1 hour window
            $lte: new Date(actualTime.getTime() + 60 * 60 * 1000),
          },
        });

        let actualLevel: number | null = null;

        if (actualEntry) {
          actualLevel = actualEntry["fillLevel"] || 0;
        } else {
          // Fallback: get current bin level
          const bin = await Bin.findOne({ binId: pred.binId }).lean();
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
        logger.debug('No accuracy data available', { binId, predictionsCount: predictions.length });
        return;
      }

      // Calculate accuracy metrics by source
      const metricsBySource: Record<string, {
        errors: number[];
        percentageErrors: number[];
      }> = {};

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

      // Calculate and store metrics for each source
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const [source, data] of Object.entries(metricsBySource)) {
        if (data.errors.length === 0) continue;

        const mae = data.errors.reduce((sum, e) => sum + e, 0) / data.errors.length;
        const rmse = Math.sqrt(
          data.errors.reduce((sum, e) => sum + e * e, 0) / data.errors.length
        );
        const mape = data.percentageErrors.reduce((sum, e) => sum + e, 0) / data.percentageErrors.length;

        // Store accuracy metrics
        await PredictionAccuracy.findOneAndUpdate(
          {
            binId: binId || null,
            date: today,
            source: source as 'ml-service' | 'fallback',
          },
          {
            $set: {
              mae: parseFloat(mae.toFixed(2)),
              rmse: parseFloat(rmse.toFixed(2)),
              mape: parseFloat(mape.toFixed(2)),
              sampleCount: data.errors.length,
            },
          },
          {
            upsert: true,
            new: true,
          }
        );

        logger.debug('Prediction accuracy updated', {
          binId: binId || 'all',
          source,
          mae: parseFloat(mae.toFixed(2)),
          rmse: parseFloat(rmse.toFixed(2)),
          mape: parseFloat(mape.toFixed(2)),
          sampleCount: data.errors.length,
        });
      }

      // Also calculate aggregate metrics across all sources
      const allErrors = accuracyData.map((d) => Math.abs(d.predicted - d.actual));
      const allPercentageErrors = accuracyData.map((d) =>
        d.actual > 0 ? (Math.abs(d.predicted - d.actual) / d.actual) * 100 : 0
      );

      if (allErrors.length > 0) {
        const aggregateMae = allErrors.reduce((sum, e) => sum + e, 0) / allErrors.length;
        const aggregateRmse = Math.sqrt(
          allErrors.reduce((sum, e) => sum + e * e, 0) / allErrors.length
        );
        const aggregateMape = allPercentageErrors.reduce((sum, e) => sum + e, 0) / allPercentageErrors.length;

        await PredictionAccuracy.findOneAndUpdate(
          {
            binId: binId || null,
            date: today,
            source: 'aggregate',
          },
          {
            $set: {
              mae: parseFloat(aggregateMae.toFixed(2)),
              rmse: parseFloat(aggregateRmse.toFixed(2)),
              mape: parseFloat(aggregateMape.toFixed(2)),
              sampleCount: allErrors.length,
            },
          },
          {
            upsert: true,
            new: true,
          }
        );
      }
    } catch (error) {
      logger.error('Prediction accuracy tracking error', {
        error,
        binId,
      });
    }
  }

  /**
   * Run prediction accuracy tracking for all bins
   * This should be called daily to track overall accuracy
   */
  static async runDailyAccuracyTracking(): Promise<void> {
    try {
      logger.info('Running daily prediction accuracy tracking');

      // Run accuracy tracking for all bins (no binId filter)
      await this.updatePredictionAccuracy();

      logger.info('Daily prediction accuracy tracking completed');
    } catch (error) {
      logger.error('Daily accuracy tracking error', { error });
    }
  }

  /**
   * Get training data for ML model
   */
  static async getTrainingData(binId?: string): Promise<BinHistoryEntry[]> {
    const db = mongoose.connection.db;
    if (!db) return [];

    const collection = db.collection("bin_history");
    const query: any = {
      actualFillLevel24h: { $exists: true }, // Only entries with labels
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
      // Convert MongoDB documents to BinHistoryEntry format
      return data.map((doc: any) => ({
        binId: doc.binId || doc["binId"],
        timestamp:
          doc.timestamp instanceof Date
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
      })) as BinHistoryEntry[];
    } catch (error) {
      logger.error("Failed to get training data", { error });
      return [];
    }
  }

  /**
   * Export data for ML training
   */
  static async exportTrainingData(binId?: string): Promise<string> {
    const data = await this.getTrainingData(binId);

    // Convert to CSV format
    const csv = [
      "binId,timestamp,fillLevel,binType,latitude,longitude,dayOfWeek,hourOfDay,actualFillLevel24h",
      ...data.map((d) =>
        [
          d.binId,
          d.timestamp.toISOString(),
          d.fillLevel,
          d.binType,
          d.location.latitude,
          d.location.longitude,
          d.dayOfWeek,
          d.hourOfDay,
          d.actualFillLevel24h || "",
        ].join(","),
      ),
    ].join("\n");

    return csv;
  }

  /**
   * Get data collection statistics
   */
  static async getStats(): Promise<{
    totalEntries: number;
    entriesWithLabels: number;
    binsTracked: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  }> {
    const db = mongoose.connection.db;
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

    const [totalEntries, entriesWithLabels, oldest, newest, bins] =
      await Promise.all([
        collection.countDocuments(),
        collection.countDocuments({ actualFillLevel24h: { $exists: true } }),
        collection.findOne({}, { sort: { timestamp: 1 } }),
        collection.findOne({}, { sort: { timestamp: -1 } }),
        collection.distinct("binId"),
      ]);

    // Safely extract timestamps from MongoDB documents
    const getTimestamp = (doc: any): Date | null => {
      if (!doc) return null;
      const ts = doc["timestamp"] || doc.timestamp;
      if (!ts) return null;
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
