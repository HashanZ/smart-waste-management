"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const adminController_1 = require("../controllers/adminController");
const validateRequest_1 = require("../middleware/validateRequest");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/ml/health', auth_1.authenticate, adminController_1.AdminController.mlHealth);
router.use(auth_1.authenticate, (0, auth_1.authorize)('admin'));
const createUserValidation = [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').isLength({ min: 6 }),
    (0, express_validator_1.body)('firstName').trim().isLength({ min: 2, max: 50 }),
    (0, express_validator_1.body)('lastName').trim().isLength({ min: 2, max: 50 }),
    (0, express_validator_1.body)('role').isIn(['admin', 'collector', 'municipal_officer']),
    (0, express_validator_1.body)('phone').optional().isMobilePhone('any')
];
const updateUserValidation = [
    (0, express_validator_1.body)('firstName').optional().trim().isLength({ min: 2, max: 50 }),
    (0, express_validator_1.body)('lastName').optional().trim().isLength({ min: 2, max: 50 }),
    (0, express_validator_1.body)('role').optional().isIn(['admin', 'collector', 'municipal_officer']),
    (0, express_validator_1.body)('phone').optional().isMobilePhone('any'),
    (0, express_validator_1.body)('isActive').optional().isBoolean()
];
const getUsersValidation = [
    (0, express_validator_1.query)('page').optional().isNumeric().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isNumeric().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)('role').optional().isIn(['admin', 'collector', 'municipal_officer']),
    (0, express_validator_1.query)('isActive').optional().isBoolean()
];
router.get('/users', getUsersValidation, validateRequest_1.validateRequest, adminController_1.AdminController.getUsers);
router.get('/users/:id', adminController_1.AdminController.getUserById);
router.post('/users', createUserValidation, validateRequest_1.validateRequest, adminController_1.AdminController.createUser);
router.put('/users/:id', updateUserValidation, validateRequest_1.validateRequest, adminController_1.AdminController.updateUser);
router.delete('/users/:id', adminController_1.AdminController.deleteUser);
router.get('/system/status', adminController_1.AdminController.getSystemStatus);
router.get('/logs', adminController_1.AdminController.getLogs);
router.post('/maintenance', adminController_1.AdminController.scheduleMaintenance);
exports.default = router;
//# sourceMappingURL=admin.js.map