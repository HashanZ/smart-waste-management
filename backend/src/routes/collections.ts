import { Router } from 'express';
import { body, query } from 'express-validator';
import { CollectionController } from '@/controllers/collectionController';
import { validateRequest } from '@/middleware/validateRequest';
import { authenticate, authorize } from '@/middleware/auth';

const router = Router();

// Validation rules
const createCollectionValidation = [
  body('binId').notEmpty(),
  body('collectorId').notEmpty(),
  body('collectionDate').isISO8601(),
  body('wasteType').isIn(['general', 'recyclable', 'organic', 'hazardous']),
  body('collectionMethod').optional().isIn(['manual', 'automated']),
  body('notes').optional().isLength({ max: 500 })
];

const updateCollectionValidation = [
  body('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled']),
  body('actualCollectionTime').optional().isISO8601(),
  body('notes').optional().isLength({ max: 500 }),
  body('weight').optional().isNumeric().isFloat({ min: 0 }),
  body('volume').optional().isNumeric().isFloat({ min: 0 }),
  body('qualityScore').optional().isNumeric().isFloat({ min: 1, max: 10 }),
  body('issues').optional().isArray()
];

const getCollectionsValidation = [
  query('page').optional().isNumeric().isInt({ min: 1 }),
  query('limit').optional().isNumeric().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled']),
  query('wasteType').optional().isIn(['general', 'recyclable', 'organic', 'hazardous']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
];

// Routes
router.get('/', getCollectionsValidation, validateRequest, authenticate, CollectionController.getCollections);
router.get('/:id', authenticate, CollectionController.getCollectionById);
router.post('/', createCollectionValidation, validateRequest, authenticate, authorize('admin', 'municipal_officer'), CollectionController.createCollection);
router.put('/:id', updateCollectionValidation, validateRequest, authenticate, CollectionController.updateCollection);
router.delete('/:id', authenticate, authorize('admin'), CollectionController.deleteCollection);
router.post('/:id/complete', authenticate, CollectionController.completeCollection);
router.post('/:id/cancel', authenticate, CollectionController.cancelCollection);

export default router;


