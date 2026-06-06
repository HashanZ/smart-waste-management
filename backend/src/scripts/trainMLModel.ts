import mongoose from "mongoose";
import { config } from "@/config/config";
import { DataCollector } from "@/services/dataCollector";
import { MLClient } from "@/services/mlClient";
import { logger } from "@/utils/logger";

async function trainModel() {
  try {
    logger.info("Starting ML model training...");

    // Connect to database with extended timeout options (fixes DNS issues)
    await mongoose.connect(config.database.mongodbUri, {
      serverSelectionTimeoutMS: 30000, // Increased from default for DNS resolution
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      retryWrites: true,
      retryReads: true,
    });
    logger.info("✅ Connected to MongoDB");

    // Get training data
    logger.info("Collecting training data...");
    const trainingData = await DataCollector.getTrainingData();

    if (trainingData.length < 50) {
      logger.warn(
        `⚠️ Not enough data: ${trainingData.length} samples. Need at least 50.`,
      );
      logger.info(
        "💡 Continue collecting data for a few days, then retry this script.",
      );

      // Show stats
      const stats = await DataCollector.getStats();
      logger.info("📊 Data Collection Stats:", stats);

      await mongoose.disconnect();
      process.exit(0);
    }

    logger.info(`✅ Found ${trainingData.length} training samples`);

    // Format data for ML service
    // Flatten location object into latitude/longitude columns for ML service
    const formattedData = trainingData.map((d) => ({
      binId: d.binId,
      timestamp:
        d.timestamp instanceof Date ? d.timestamp.toISOString() : d.timestamp,
      fillLevel: d.fillLevel,
      binType: d.binType,
      latitude: d.location?.latitude || 0,
      longitude: d.location?.longitude || 0,
      dayOfWeek: d.dayOfWeek,
      hourOfDay: d.hourOfDay,
      actualFillLevel24h: d.actualFillLevel24h || d.fillLevel,
    }));

    // Train model
    logger.info("🤖 Training ML model...");
    const mlClient = new MLClient();
    const result = await mlClient.trainModel(formattedData);

    if (result.success) {
      logger.info("✅ Model training successful!", {
        trainScore: result.train_score,
        testScore: result.test_score,
        samples: result.n_samples,
      });
      logger.info(
        `📈 Model R² Score - Train: ${result.train_score?.toFixed(3)}, Test: ${result.test_score?.toFixed(3)}`,
      );
      logger.info("💾 Model saved to ml-service/models/");
    } else {
      logger.error("❌ Model training failed", { message: result.message });
    }

    await mongoose.disconnect();
    logger.info("✅ Disconnected from MongoDB");
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    logger.error("❌ Training script error");
    if (error instanceof Error) {
      logger.error(`Error message: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
    } else {
      logger.error(`Error: ${JSON.stringify(error)}`);
    }
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Run training
trainModel();
