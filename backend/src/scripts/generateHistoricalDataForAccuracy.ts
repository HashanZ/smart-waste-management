/**
 * Generate Historical Data for Prediction Accuracy Tracking
 *
 * This script creates historical bin data and predictions
 * so that the ML Prediction Analytics can show actual accuracy metrics.
 *
 * Usage: npm run generate:historical
 */

import mongoose from "mongoose";
import { config } from "@/config/config";
import { Bin } from "@/models/Bin";
import { Prediction } from "@/models/Prediction";
import { PredictionAccuracy } from "@/models/PredictionAccuracy";
import { logger } from "@/utils/logger";

async function generateHistoricalData() {
  try {
    logger.info("📊 Generating historical data for prediction accuracy...");

    await mongoose.connect(config.database.mongodbUri);
    logger.info("✅ Connected to MongoDB");

    // Get all bins
    const bins = await Bin.find({ status: "active" }).limit(100).lean();
    logger.info(`Found ${bins.length} bins`);

    if (bins.length === 0) {
      logger.error("❌ No bins found. Please run create:500bins first.");
      await mongoose.disconnect();
      process.exit(1);
    }

    const db = mongoose.connection.db;
    if (!db) {
      logger.error("❌ Database connection not available");
      await mongoose.disconnect();
      process.exit(1);
    }

    const binHistoryCollection = db.collection("bin_history");

    // Generate historical data for the last 7 days
    const now = new Date();
    let accuracyDataCount = 0;
    let predictionAccuracyCount = 0;

    for (const bin of bins.slice(0, 50)) { // Process 50 bins
      for (let dayOffset = 7; dayOffset >= 1; dayOffset--) {
        // Actual fill level at this time
        const actualDate = new Date(now);
        actualDate.setDate(actualDate.getDate() - dayOffset);
        actualDate.setHours(Math.floor(Math.random() * 24), 0, 0, 0);

        // Prediction was made 24 hours before actual date
        const predictionDate = new Date(actualDate);
        predictionDate.setHours(predictionDate.getHours() - 24);

        // Create realistic levels
        const baseLevel = Math.floor(Math.random() * 80) + 10; // 10-90%
        const predictedLevel = Math.max(0, Math.min(100, baseLevel + Math.floor(Math.random() * 15) - 7));
        const actualLevel = Math.max(0, Math.min(100, baseLevel + Math.floor(Math.random() * 12) - 6));

        // Create prediction first (24h before actual)
        await Prediction.create({
          binId: bin.binId,
          horizonHours: 24,
          predictedLevel,
          timeToFullHours: predictedLevel > 85 ? 12 : null,
          riskLevel: predictedLevel >= 85 ? "critical" : predictedLevel >= 70 ? "high" : predictedLevel >= 50 ? "medium" : "low",
          recommendedCollectionTime: predictedLevel > 85 ? new Date(actualDate.getTime() + 6 * 60 * 60 * 1000) : null,
          confidence: 0.7 + Math.random() * 0.3,
          factors: ["historical_pattern", "time_of_day"],
          source: Math.random() > 0.2 ? "ml-service" : "fallback",
          createdAt: predictionDate,
        });

        // Store actual fill level in bin_history (24h after prediction)
        await binHistoryCollection.insertOne({
          binId: bin.binId,
          timestamp: actualDate,
          fillLevel: actualLevel,
          binType: bin.binType || "general",
          location: bin.location || { latitude: 6.9271, longitude: 79.8612 },
          dayOfWeek: actualDate.getDay(),
          hourOfDay: actualDate.getHours(),
          wasCollected: false,
          actualFillLevel24h: actualLevel,
        });

        accuracyDataCount++;
      }
    }

    logger.info(`✅ Created ${accuracyDataCount} historical data points`);

    // Now calculate and store accuracy metrics
    logger.info("📈 Calculating prediction accuracy metrics...");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get predictions from yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const predictions = await Prediction.find({
      createdAt: {
        $gte: yesterday,
        $lt: today,
      },
    }).lean();

    logger.info(`Found ${predictions.length} predictions to evaluate`);

    const accuracyData: Array<{
      predicted: number;
      actual: number;
      source: string;
    }> = [];

    for (const pred of predictions) {
      // Get actual fill level from bin_history
      const actualTime = new Date(pred.createdAt);
      actualTime.setHours(actualTime.getHours() + 24); // 24 hours after prediction

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
          source: pred.source,
        });
      }
    }

    if (accuracyData.length === 0) {
      logger.warn("⚠️  No accuracy data available. Creating sample accuracy metrics...");

      // Create sample accuracy metrics
      const sampleMetrics = {
        ml: {
          errors: [5, 8, 12, 6, 10, 7, 9, 11, 8, 6],
          percentageErrors: [8, 12, 15, 9, 13, 10, 11, 14, 10, 8],
        },
        fallback: {
          errors: [15, 20, 18, 22, 16, 19, 21, 17, 20, 18],
          percentageErrors: [20, 25, 22, 28, 21, 24, 26, 22, 25, 23],
        },
      };

      for (const [source, data] of Object.entries(sampleMetrics)) {
        const mae = data.errors.reduce((sum, e) => sum + e, 0) / data.errors.length;
        const rmse = Math.sqrt(
          data.errors.reduce((sum, e) => sum + e * e, 0) / data.errors.length
        );
        const mape = data.percentageErrors.reduce((sum, e) => sum + e, 0) / data.percentageErrors.length;

        await PredictionAccuracy.findOneAndUpdate(
          {
            binId: null,
            date: today,
            source: source as "ml-service" | "fallback",
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

        predictionAccuracyCount++;
      }
    } else {
      // Calculate metrics by source
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

      for (const [source, data] of Object.entries(metricsBySource)) {
        if (data.errors.length === 0) continue;

        const mae = data.errors.reduce((sum, e) => sum + e, 0) / data.errors.length;
        const rmse = Math.sqrt(
          data.errors.reduce((sum, e) => sum + e * e, 0) / data.errors.length
        );
        const mape = data.percentageErrors.reduce((sum, e) => sum + e, 0) / data.percentageErrors.length;

        await PredictionAccuracy.findOneAndUpdate(
          {
            binId: null,
            date: today,
            source: source as "ml-service" | "fallback",
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

        predictionAccuracyCount++;
      }
    }

    logger.info(`✅ Created ${predictionAccuracyCount} accuracy metric records`);
    logger.info("\n📊 Summary:");
    logger.info(`   - Historical data points: ${accuracyDataCount}`);
    logger.info(`   - Accuracy records: ${predictionAccuracyCount}`);
    logger.info("\n💡 The ML Prediction Analytics section should now show data!");

    await mongoose.disconnect();
    logger.info("✅ Disconnected from MongoDB");
  } catch (error: any) {
    logger.error("❌ Error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  generateHistoricalData().catch((error) => {
    logger.error("Script failed:", error);
    process.exit(1);
  });
}

export { generateHistoricalData };

