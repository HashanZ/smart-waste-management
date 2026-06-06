import cron from 'node-cron';
import { logger } from '@/utils/logger';
import { Bin } from '@/models/Bin';
import { Prediction } from '@/models/Prediction';
import { Collection } from '@/models/Collection';
import { User } from '@/models/User';

export class SchedulerService {
  static start(): void {
    // Run hourly at minute 5
    cron.schedule('5 * * * *', async () => {
      await SchedulerService.runHourlyPredictions();
    }, { timezone: 'UTC' });

    // Run collection scheduling every 6 hours at minute 0
    cron.schedule('0 */6 * * *', async () => {
      await SchedulerService.scheduleAutomaticCollections();
    }, { timezone: 'UTC' });

    // Run daily accuracy tracking at 1 AM
    cron.schedule('0 1 * * *', async () => {
      await SchedulerService.runDailyAccuracyTracking();
    }, { timezone: 'UTC' });

    // Run weekly model retraining every Sunday at 2 AM
    cron.schedule('0 2 * * 0', async () => {
      await SchedulerService.runWeeklyModelRetraining();
    }, { timezone: 'UTC' });

    // Also run collection scheduling on startup (after 1 minute delay)
    setTimeout(() => {
      SchedulerService.scheduleAutomaticCollections();
    }, 60000); // 1 minute delay

    logger.info('SchedulerService started: hourly predictions, automatic collection scheduling, daily accuracy tracking, and weekly model retraining enabled');
  }

  static async runHourlyPredictions(): Promise<void> {
    try {
      logger.info('Hourly prediction job started');

      const activeBins = await Bin.find({ status: 'active' })
        .select('binId binType currentLevel capacity location')
        .limit(200)
        .lean();

      if (activeBins.length === 0) {
        logger.info('Hourly prediction job: no active bins');
        return;
      }

      const { MLClient } = await import('@/services/mlClient');
      const mlClient = new MLClient();

      for (const bin of activeBins) {
        try {
          const prediction = await mlClient.predictWaste(
            bin.binId,
            bin.binType,
            bin.currentLevel,
            bin.capacity,
            bin.location,
            24, // 24-hour horizon
          );

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

          // Flag bin if likely to exceed 85% in next 24h
          if (prediction.predicted_level >= 85) {
            await Bin.updateOne({ binId: bin.binId }, { $set: { isOverflowing: true } });
          }
        } catch (err) {
          logger.warn('Hourly prediction failed for bin', { binId: bin.binId, err });
        }
      }

      logger.info('Hourly prediction job completed', { count: activeBins.length });
    } catch (error) {
      logger.error('Hourly prediction job error', { error });
    }
  }

  /**
   * Automatically schedule collections for bins that need collection
   */
  static async scheduleAutomaticCollections(): Promise<void> {
    try {
      logger.info('Automatic collection scheduling job started');

      // Find bins that need collection:
      // 1. Bins that are overflowing (currentLevel >= 85)
      // 2. Bins with high fill level (currentLevel >= 70)
      // 3. Bins predicted to overflow soon (predictedLevel >= 85 in next 24h)
      const binsNeedingCollection = await Bin.find({
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
        logger.info('Automatic collection scheduling: no bins need collection');
        return;
      }

      // Get a default collector (first active collector or admin)
      const defaultCollector = await User.findOne({
        $or: [
          { role: 'collector', isActive: true },
          { role: 'admin', isActive: true },
        ],
      })
        .select('_id firstName lastName email')
        .lean();

      if (!defaultCollector) {
        logger.warn('Automatic collection scheduling: no collector found, skipping');
        return;
      }

      // Check existing scheduled collections to avoid duplicates
      const existingCollections = await Collection.find({
        binId: { $in: binsNeedingCollection.map(b => b.binId) },
        status: { $in: ['scheduled', 'in_progress'] },
        scheduledDate: {
          $gte: new Date(),
        },
      })
        .select('binId')
        .lean();

      const binsWithExistingCollections = new Set(
        existingCollections.map(c => c.binId)
      );

      let scheduledCount = 0;
      const now = new Date();

      for (const bin of binsNeedingCollection) {
        // Skip if collection already scheduled
        if (binsWithExistingCollections.has(bin.binId)) {
          continue;
        }

        try {
          // Determine priority based on fill level
          let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
          if (bin.currentLevel >= 90 || (bin as any).isOverflowing) {
            priority = 'urgent';
          } else if (bin.currentLevel >= 85) {
            priority = 'high';
          } else if (bin.currentLevel >= 70) {
            priority = 'medium';
          }

          // Schedule collection for next 24 hours (urgent) or next 48 hours (others)
          const scheduledDate = new Date(now);
          if (priority === 'urgent' || priority === 'high') {
            scheduledDate.setHours(scheduledDate.getHours() + 6); // Within 6 hours
          } else {
            scheduledDate.setHours(scheduledDate.getHours() + 24); // Within 24 hours
          }

          // Generate unique collectionId
          const collectionCount = await Collection.countDocuments();
          const collectionId = `COL${String(collectionCount + 1).padStart(6, '0')}`;

          // Create collection
          await Collection.create({
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
            wasteType: bin.binType as 'general' | 'recyclable' | 'organic' | 'hazardous',
            priority,
          });

          scheduledCount++;
          logger.info(`Scheduled automatic collection for bin ${bin.binId}`, {
            binId: bin.binId,
            priority,
            scheduledDate,
          });
        } catch (err: any) {
          logger.warn('Failed to schedule collection for bin', {
            binId: bin.binId,
            error: err.message,
          });
        }
      }

      logger.info('Automatic collection scheduling job completed', {
        binsChecked: binsNeedingCollection.length,
        scheduled: scheduledCount,
        skipped: binsNeedingCollection.length - scheduledCount,
      });
    } catch (error) {
      logger.error('Automatic collection scheduling job error', { error });
    }
  }

  /**
   * Run daily prediction accuracy tracking
   */
  static async runDailyAccuracyTracking(): Promise<void> {
    try {
      const { DataCollector } = await import('@/services/dataCollector');
      await DataCollector.runDailyAccuracyTracking();
    } catch (error) {
      logger.error('Daily accuracy tracking job error', { error });
    }
  }

  /**
   * Run weekly model retraining
   * Retrains the ML model with the latest data
   */
  static async runWeeklyModelRetraining(): Promise<void> {
    try {
      logger.info('Starting weekly model retraining');

      // Check if we have enough training data
      const { DataCollector } = await import('@/services/dataCollector');
      const stats = await DataCollector.getStats();

      if (stats.entriesWithLabels < 50) {
        logger.warn('Not enough training data for model retraining', {
          entriesWithLabels: stats.entriesWithLabels,
          minimumRequired: 50,
        });
        return;
      }

      logger.info('Training data available', {
        entriesWithLabels: stats.entriesWithLabels,
        binsTracked: stats.binsTracked,
      });

      // Use child_process to run the training script
      const { exec } = require('child_process');
      const path = require('path');
      const backendDir = path.join(__dirname, '..', '..');

      exec(
        'npm run train:ml',
        {
          cwd: backendDir,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
        },
        (error: any, stdout: string, stderr: string) => {
          if (error) {
            logger.error('Model retraining failed', {
              error: error.message,
              code: error.code,
              signal: error.signal,
              stderr,
            });
            return;
          }

          logger.info('Model retraining completed successfully', {
            stdout: stdout.substring(0, 500), // Log first 500 chars
            stderr: stderr || 'none',
          });

          // Log a summary
          if (stdout.includes('success') || stdout.includes('completed')) {
            logger.info('✅ ML model retraining completed - model should be reloaded automatically');
          }
        }
      );
    } catch (error) {
      logger.error('Model retraining error', { error });
    }
  }
}









