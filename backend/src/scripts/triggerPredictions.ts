import mongoose from 'mongoose';
import { config } from '@/config/config';
import { Bin } from '@/models/Bin';
import { MLClient } from '@/services/mlClient';
import { Prediction } from '@/models/Prediction';
import { logger } from '@/utils/logger';

async function triggerPredictions() {
  try {
    logger.info('Starting manual prediction trigger...');

    // Connect to MongoDB
    await mongoose.connect(config.database.mongodbUri);
    logger.info('✅ Connected to MongoDB');

    // Get all active bins
    const activeBins = await Bin.find({ status: 'active' })
      .select('binId binType currentLevel capacity location')
      .limit(200)
      .lean();

    if (activeBins.length === 0) {
      logger.info('No active bins found');
      await mongoose.disconnect();
      return;
    }

    logger.info(`Found ${activeBins.length} active bins`);

    // Initialize ML client
    const mlClient = new MLClient();

    // Check ML service health
    const isHealthy = await mlClient.healthCheck();
    if (!isHealthy) {
      logger.error('❌ ML service is not healthy. Please ensure it is running.');
      await mongoose.disconnect();
      process.exit(1);
    }
    logger.info('✅ ML service is healthy');

    // Generate predictions for each bin
    let successCount = 0;
    let failCount = 0;

    for (const bin of activeBins) {
      try {
        logger.info(`Generating prediction for bin ${bin.binId}...`);

        const prediction = await mlClient.predictWaste(
          bin.binId,
          bin.binType,
          bin.currentLevel || 0,
          bin.capacity,
          bin.location as { latitude: number; longitude: number },
          24, // 24-hour horizon
        );

        // Save prediction to database
        await Prediction.create({
          binId: bin.binId,
          horizonHours: 24,
          predictedLevel: prediction.predicted_level,
          timeToFullHours: prediction.time_to_full_hours ?? null,
          riskLevel: prediction.risk_level as 'low' | 'medium' | 'high' | 'critical',
          recommendedCollectionTime: prediction.recommended_collection_time ? new Date(prediction.recommended_collection_time) : null,
          confidence: prediction.confidence,
          factors: prediction.factors ?? [],
          source: 'ml-service',
        });

        logger.info(`✅ Prediction created for ${bin.binId} - Source: ML Model, Confidence: ${prediction.confidence}`);
        successCount++;

        // Flag bin if likely to exceed 85% in next 24h
        if (prediction.predicted_level >= 85) {
          await Bin.updateOne({ binId: bin.binId }, { $set: { isOverflowing: true } });
        }
      } catch (err: any) {
        logger.error(`❌ Prediction failed for bin ${bin.binId}`, {
          error: err.message,
          stack: err.stack,
          response: err.response?.data,
          status: err.response?.status,
          statusText: err.response?.statusText,
        });
        failCount++;
      }
    }

    logger.info(`\n📊 Prediction Summary:`);
    logger.info(`   ✅ Successful: ${successCount}`);
    logger.info(`   ❌ Failed: ${failCount}`);
    logger.info(`   📈 Total: ${activeBins.length}`);

    await mongoose.disconnect();
    logger.info('✅ Disconnected from MongoDB');
    logger.info('✅ Manual prediction trigger completed!');

  } catch (error) {
    logger.error('❌ Error in prediction trigger:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
triggerPredictions();

