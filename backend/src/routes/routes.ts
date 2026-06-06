import { Router } from 'express';
import { body, query } from 'express-validator';
import { RouteController } from '@/controllers/routeController';
import { validateRequest } from '@/middleware/validateRequest';
import { authenticate, authorize } from '@/middleware/auth';

const router = Router();

// Validation rules
const createRouteValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('description').optional().isLength({ max: 500 }),
  body('collectorId').optional().isString(),
  body('bins').isArray({ min: 1 }),
  body('bins.*').notEmpty(),
  body('scheduledDate').isISO8601(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
];

const updateRouteValidation = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('description').optional().isLength({ max: 500 }),
  body('bins').optional().isArray({ min: 1 }),
  body('bins.*').optional().notEmpty(),
  body('scheduledDate').optional().isISO8601(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('status').optional().isIn(['draft', 'scheduled', 'active', 'completed', 'cancelled'])
];

const getRoutesValidation = [
  query('page').optional().isNumeric().isInt({ min: 1 }),
  query('limit').optional().isNumeric().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['draft', 'active', 'completed', 'cancelled']),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  query('collectorId').optional().notEmpty(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
];

// Routes
router.get('/', getRoutesValidation, validateRequest, authenticate, RouteController.getRoutes);
router.get('/:id', authenticate, RouteController.getRouteById);
router.post('/', createRouteValidation, validateRequest, authenticate, authorize('admin', 'municipal_officer'), RouteController.createRoute);
router.put('/:id', updateRouteValidation, validateRequest, authenticate, RouteController.updateRoute);
router.delete('/:id', authenticate, authorize('admin'), RouteController.deleteRoute);
router.post('/optimize-direct', authenticate, RouteController.optimizeRouteDirect);
router.post('/:id/optimize', authenticate, RouteController.optimizeRoute);
router.post('/:id/start', authenticate, RouteController.startRoute);
router.post('/:id/complete', authenticate, RouteController.completeRoute);
router.post('/:id/bins/:binId/visit', authenticate, RouteController.markBinVisited);
router.post('/:id/bins/:binId/skip', authenticate, RouteController.markBinSkipped);

export default router;


