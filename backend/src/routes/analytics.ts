import { Router } from 'express';
import { query } from 'express-validator';
import { AnalyticsController } from '@/controllers/analyticsController';
import { validateRequest } from '@/middleware/validateRequest';
import { authenticate } from '@/middleware/auth';

const router = Router();

// Validation rules
const getMetricsValidation = [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('binType').optional().isIn(['general', 'recyclable', 'organic', 'hazardous']),
  query('groupBy').optional().isIn(['day', 'week', 'month', 'year'])
];

const getPredictionsValidation = [
  query('binId').optional().notEmpty(),
  query('days').optional().isNumeric().isInt({ min: 1, max: 30 })
];

// Routes
router.get('/metrics', getMetricsValidation, validateRequest, authenticate, AnalyticsController.getMetrics);
router.get('/predictions', getPredictionsValidation, validateRequest, authenticate, AnalyticsController.getPredictions);
router.get('/predictions/metrics', authenticate, AnalyticsController.getPredictionMetrics);
router.get('/dashboard', authenticate, AnalyticsController.getDashboardData);
router.get('/bins/status', authenticate, AnalyticsController.getBinStatusSummary);
router.get('/collections/summary', authenticate, AnalyticsController.getCollectionSummary);
router.get('/routes/performance', authenticate, AnalyticsController.getRoutePerformance);
router.get('/alerts/summary', authenticate, AnalyticsController.getAlertSummary);

export default router;
