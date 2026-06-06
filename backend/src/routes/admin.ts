import { Router } from 'express';
import { body, query } from 'express-validator';
import { AdminController } from '@/controllers/adminController';
import { validateRequest } from '@/middleware/validateRequest';
import { authenticate, authorize } from '@/middleware/auth';

const router = Router();

// ML health endpoint - accessible to all authenticated users
router.get('/ml/health', authenticate, AdminController.mlHealth);

// All other admin routes require admin role
router.use(authenticate, authorize('admin'));

// Validation rules
const createUserValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().isLength({ min: 2, max: 50 }),
  body('lastName').trim().isLength({ min: 2, max: 50 }),
  body('role').isIn(['admin', 'collector', 'municipal_officer']),
  body('phone').optional().isMobilePhone('any')
];

const updateUserValidation = [
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }),
  body('role').optional().isIn(['admin', 'collector', 'municipal_officer']),
  body('phone').optional().isMobilePhone('any'),
  body('isActive').optional().isBoolean()
];

const getUsersValidation = [
  query('page').optional().isNumeric().isInt({ min: 1 }),
  query('limit').optional().isNumeric().isInt({ min: 1, max: 100 }),
  query('role').optional().isIn(['admin', 'collector', 'municipal_officer']),
  query('isActive').optional().isBoolean()
];

// Routes
router.get('/users', getUsersValidation, validateRequest, AdminController.getUsers);
router.get('/users/:id', AdminController.getUserById);

router.post('/users', createUserValidation, validateRequest, AdminController.createUser);
router.put('/users/:id', updateUserValidation, validateRequest, AdminController.updateUser);
router.delete('/users/:id', AdminController.deleteUser);
router.get('/system/status', AdminController.getSystemStatus);
router.get('/logs', AdminController.getLogs);
router.post('/maintenance', AdminController.scheduleMaintenance);

export default router;


