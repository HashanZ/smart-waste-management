import { Router } from 'express';
import { DataCollector } from '@/services/dataCollector';
import { ResponseHandler } from '@/utils/response';
import { authenticate } from '@/middleware/auth';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * Get data collection statistics
 */
router.get('/stats', authenticate, async (_req, res) => {
  try {
    const stats = await DataCollector.getStats();
    ResponseHandler.success(res, stats, 'Data collection statistics retrieved');
  } catch (error: unknown) {
    logger.error('Failed to get data collection stats', { error });
    ResponseHandler.error(res, 'Failed to get statistics', 500);
  }
});

/**
 * Export training data as CSV
 */
router.get('/export', authenticate, async (req, res) => {
  try {
    const { binId } = req.query;
    const csv = await DataCollector.exportTrainingData(binId as string | undefined);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=training_data.csv');
    res.send(csv);
  } catch (error: unknown) {
    logger.error('Failed to export training data', { error });
    ResponseHandler.error(res, 'Failed to export data', 500);
  }
});

/**
 * Manually trigger data collection
 */
router.post('/collect', authenticate, async (_req, res) => {
  try {
    await DataCollector.collectBinData();
    ResponseHandler.success(res, null, 'Data collection triggered successfully');
  } catch (error: unknown) {
    logger.error('Failed to trigger data collection', { error });
    ResponseHandler.error(res, 'Failed to collect data', 500);
  }
});

export default router;










