"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const alertController_1 = require("../controllers/alertController");
const validateRequest_1 = require("../middleware/validateRequest");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const getAlertsValidation = [
    (0, express_validator_1.query)('status').optional().isIn(['active', 'resolved']),
    (0, express_validator_1.query)('type').optional().isIn(['overflow', 'full', 'maintenance', 'offline']),
    (0, express_validator_1.query)('limit').optional().isNumeric().isInt({ min: 1, max: 500 })
];
router.get('/', getAlertsValidation, validateRequest_1.validateRequest, auth_1.authenticate, alertController_1.AlertController.getAlerts);
router.get('/summary', auth_1.authenticate, alertController_1.AlertController.getAlertSummary);
exports.default = router;
//# sourceMappingURL=alerts.js.map