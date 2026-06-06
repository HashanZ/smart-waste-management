"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const analyticsController_1 = require("../controllers/analyticsController");
const validateRequest_1 = require("../middleware/validateRequest");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const getMetricsValidation = [
    (0, express_validator_1.query)('startDate').optional().isISO8601(),
    (0, express_validator_1.query)('endDate').optional().isISO8601(),
    (0, express_validator_1.query)('binType').optional().isIn(['general', 'recyclable', 'organic', 'hazardous']),
    (0, express_validator_1.query)('groupBy').optional().isIn(['day', 'week', 'month', 'year'])
];
const getPredictionsValidation = [
    (0, express_validator_1.query)('binId').optional().notEmpty(),
    (0, express_validator_1.query)('days').optional().isNumeric().isInt({ min: 1, max: 30 })
];
router.get('/metrics', getMetricsValidation, validateRequest_1.validateRequest, auth_1.authenticate, analyticsController_1.AnalyticsController.getMetrics);
router.get('/predictions', getPredictionsValidation, validateRequest_1.validateRequest, auth_1.authenticate, analyticsController_1.AnalyticsController.getPredictions);
router.get('/predictions/metrics', auth_1.authenticate, analyticsController_1.AnalyticsController.getPredictionMetrics);
router.get('/dashboard', auth_1.authenticate, analyticsController_1.AnalyticsController.getDashboardData);
router.get('/bins/status', auth_1.authenticate, analyticsController_1.AnalyticsController.getBinStatusSummary);
router.get('/collections/summary', auth_1.authenticate, analyticsController_1.AnalyticsController.getCollectionSummary);
router.get('/routes/performance', auth_1.authenticate, analyticsController_1.AnalyticsController.getRoutePerformance);
router.get('/alerts/summary', auth_1.authenticate, analyticsController_1.AnalyticsController.getAlertSummary);
exports.default = router;
//# sourceMappingURL=analytics.js.map