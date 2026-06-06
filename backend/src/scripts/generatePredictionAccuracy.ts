/**
 * Generate Prediction Accuracy Records
 *
 * This script creates prediction accuracy records by comparing predictions
 * with actual bin fill levels. This is needed for ML Prediction Analytics
 * to display data in the dashboard.
 *
 * Usage: npm run generate:accuracy
 * Or: ts-node -r tsconfig-paths/register src/scripts/generatePredictionAccuracy.ts
 */

import mongoose from "mongoose";
import { config } from "@/config/config";
import { Bin } from "@/models/Bin";
import { Prediction } from "@/models/Prediction";
import { PredictionAccuracy } from "@/models/PredictionAccuracy";
import { logger } from "@/utils/logger";

async function generatePredictionAccuracy() {
  try {
    logger.info("📈 Generating prediction accuracy records...");

    // Connect to MongoDB
    await mongoose.connect(config.database.mongodbUri);
    logger.info("✅ Connected to MongoDB");

    // Get bin history collection
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not available");
    }
    const binHistoryCollection = db.collection("bin_history");

    // Get predictions from the last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const predictions = await Prediction.find({
      createdAt: { $gte: sevenDaysAgo },
      horizonHours: 24, // Focus on 24h predictions
    })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    logger.info(`Found ${predictions.length} predictions to evaluate`);

    if (predictions.length === 0) {
      logger.warn("⚠️  No predictions found. Please generate predictions first.");
      await mongoose.disconnect();
      return;
    }

      // Group predictions by date
      const predictionsByDate = new Map<string, typeof predictions>();
      for (const pred of predictions) {
        const date = new Date(pred.createdAt);
        date.setHours(0, 0, 0, 0);
        const dateKey = date.toISOString().split("T")[0];

        if (!dateKey) {
          continue; // Skip if dateKey is invalid
        }

        if (!predictionsByDate.has(dateKey)) {
          predictionsByDate.set(dateKey, []);
        }
        const dayPredictions = predictionsByDate.get(dateKey);
        if (dayPredictions) {
          dayPredictions.push(pred);
        }
      }

    logger.info(`Processing ${predictionsByDate.size} days of predictions`);

    let totalAccuracyRecords = 0;

    // Process each day
    for (const [dateKey, dayPredictions] of predictionsByDate) {
      const accuracyData: Array<{
        predicted: number;
        actual: number;
        source: string;
      }> = [];

      // For each prediction, find the actual fill level 24 hours later
      for (const pred of dayPredictions) {
        const predictionTime = new Date(pred.createdAt);
        const actualTime = new Date(predictionTime.getTime() + 24 * 60 * 60 * 1000);

        // Try to find actual fill level from bin_history
        const actualEntry = await binHistoryCollection.findOne({
          binId: pred.binId,
          timestamp: {
            $gte: new Date(actualTime.getTime() - 2 * 60 * 60 * 1000), // 2 hours before
            $lte: new Date(actualTime.getTime() + 2 * 60 * 60 * 1000), // 2 hours after
          },
        });

        if (actualEntry) {
          const actualLevel = actualEntry["fillLevel"] || 0;
          accuracyData.push({
            predicted: pred.predictedLevel,
            actual: actualLevel,
            source: pred.source || "ml-service",
          });
        } else {
          // If no history, use current bin level as approximation
          const bin = await Bin.findOne({ binId: pred.binId }).lean();
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
        logger.warn(`   ⚠️  No accuracy data for ${dateKey}`);
        continue;
      }

      // Calculate accuracy metrics
      const errors = accuracyData.map((d) => Math.abs(d.predicted - d.actual));
      const squaredErrors = errors.map((e) => e * e);
      const percentageErrors = accuracyData.map(
        (d) => (d.actual > 0 ? (Math.abs(d.predicted - d.actual) / d.actual) * 100 : 0),
      );

      const mae = errors.reduce((sum, e) => sum + e, 0) / errors.length;
      const rmse = Math.sqrt(squaredErrors.reduce((sum, e) => sum + e, 0) / squaredErrors.length);
      const mape = percentageErrors.reduce((sum, e) => sum + e, 0) / percentageErrors.length;

      // Group by source
      const mlData = accuracyData.filter((d) => d.source === "ml-service");
      const fallbackData = accuracyData.filter((d) => d.source === "fallback");

      const date = new Date(dateKey);

      // Create aggregate accuracy record
      if (accuracyData.length > 0) {
        await PredictionAccuracy.create({
          binId: null, // Aggregate
          date,
          mae,
          rmse,
          mape,
          sampleCount: accuracyData.length,
          source: "aggregate",
        });
        totalAccuracyRecords++;
      }

      // Create ML-specific record
      if (mlData.length > 0) {
        const mlErrors = mlData.map((d) => Math.abs(d.predicted - d.actual));
        const mlSquaredErrors = mlErrors.map((e) => e * e);
        const mlPercentageErrors = mlData.map(
          (d) => (d.actual > 0 ? (Math.abs(d.predicted - d.actual) / d.actual) * 100 : 0),
        );

        const mlMae = mlErrors.reduce((sum, e) => sum + e, 0) / mlErrors.length;
        const mlRmse = Math.sqrt(mlSquaredErrors.reduce((sum, e) => sum + e, 0) / mlSquaredErrors.length);
        const mlMape = mlPercentageErrors.reduce((sum, e) => sum + e, 0) / mlPercentageErrors.length;

        await PredictionAccuracy.create({
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

      // Create fallback-specific record
      if (fallbackData.length > 0) {
        const fallbackErrors = fallbackData.map((d) => Math.abs(d.predicted - d.actual));
        const fallbackSquaredErrors = fallbackErrors.map((e) => e * e);
        const fallbackPercentageErrors = fallbackData.map(
          (d) => (d.actual > 0 ? (Math.abs(d.predicted - d.actual) / d.actual) * 100 : 0),
        );

        const fallbackMae = fallbackErrors.reduce((sum, e) => sum + e, 0) / fallbackErrors.length;
        const fallbackRmse = Math.sqrt(
          fallbackSquaredErrors.reduce((sum, e) => sum + e, 0) / fallbackSquaredErrors.length,
        );
        const fallbackMape = fallbackPercentageErrors.reduce((sum, e) => sum + e, 0) / fallbackPercentageErrors.length;

        await PredictionAccuracy.create({
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

      logger.info(`   ✅ Processed ${dateKey}: ${accuracyData.length} samples, MAE: ${mae.toFixed(2)}`);
    }

    logger.info(`\n✅ Created ${totalAccuracyRecords} prediction accuracy records`);
    logger.info("\n💡 Now refresh the Analytics page to see ML Prediction Analytics data!");

    await mongoose.disconnect();
    logger.info("✅ Disconnected from MongoDB");
  } catch (error: any) {
    logger.error("❌ Error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  generatePredictionAccuracy().catch((error) => {
    logger.error("Script failed:", error);
    process.exit(1);
  });
}

export { generatePredictionAccuracy };

