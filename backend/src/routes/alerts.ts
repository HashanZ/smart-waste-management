import { Router } from 'express';
import { query } from 'express-validator';
import { AlertController } from '@/controllers/alertController';
import { validateRequest } from '@/middleware/validateRequest';
import { authenticate } from '@/middleware/auth';

const router = Router();

// Validation rules
const getAlertsValidation = [
  query('status').optional().isIn(['active', 'resolved']),
  query('type').optional().isIn(['overflow', 'full', 'maintenance', 'offline']),
  query('limit').optional().isNumeric().isInt({ min: 1, max: 500 })
];

// Routes
router.get('/', getAlertsValidation, validateRequest, authenticate, AlertController.getAlerts);
router.get('/summary', authenticate, AlertController.getAlertSummary);

export default router;












