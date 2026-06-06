"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const authController_1 = require("../controllers/authController");
const validateRequest_1 = require("../middleware/validateRequest");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const registerValidation = [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').isLength({ min: 6 }),
    (0, express_validator_1.body)('firstName').trim().isLength({ min: 2, max: 50 }),
    (0, express_validator_1.body)('lastName').trim().isLength({ min: 2, max: 50 }),
    (0, express_validator_1.body)('role').isIn(['admin']),
    (0, express_validator_1.body)('phone').optional().isMobilePhone('any')
];
const loginValidation = [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
    (0, express_validator_1.body)('password').notEmpty()
];
const changePasswordValidation = [
    (0, express_validator_1.body)('currentPassword').notEmpty(),
    (0, express_validator_1.body)('newPassword').isLength({ min: 6 })
];
router.post('/register', registerValidation, validateRequest_1.validateRequest, authController_1.AuthController.register);
router.post('/login', loginValidation, validateRequest_1.validateRequest, authController_1.AuthController.login);
router.post('/logout', auth_1.authenticate, authController_1.AuthController.logout);
router.get('/me', auth_1.authenticate, authController_1.AuthController.getProfile);
router.put('/profile', auth_1.authenticate, authController_1.AuthController.updateProfile);
router.put('/change-password', auth_1.authenticate, changePasswordValidation, validateRequest_1.validateRequest, authController_1.AuthController.changePassword);
router.post('/refresh', authController_1.AuthController.refreshToken);
exports.default = router;
//# sourceMappingURL=auth.js.map