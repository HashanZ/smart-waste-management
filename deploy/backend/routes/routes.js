"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const routeController_1 = require("../controllers/routeController");
const validateRequest_1 = require("../middleware/validateRequest");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const createRouteValidation = [
    (0, express_validator_1.body)('name').trim().isLength({ min: 2, max: 100 }),
    (0, express_validator_1.body)('description').optional().isLength({ max: 500 }),
    (0, express_validator_1.body)('collectorId').notEmpty(),
    (0, express_validator_1.body)('bins').isArray({ min: 1 }),
    (0, express_validator_1.body)('bins.*').notEmpty(),
    (0, express_validator_1.body)('scheduledDate').isISO8601(),
    (0, express_validator_1.body)('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
];
const updateRouteValidation = [
    (0, express_validator_1.body)('name').optional().trim().isLength({ min: 2, max: 100 }),
    (0, express_validator_1.body)('description').optional().isLength({ max: 500 }),
    (0, express_validator_1.body)('bins').optional().isArray({ min: 1 }),
    (0, express_validator_1.body)('bins.*').optional().notEmpty(),
    (0, express_validator_1.body)('scheduledDate').optional().isISO8601(),
    (0, express_validator_1.body)('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    (0, express_validator_1.body)('status').optional().isIn(['draft', 'active', 'completed', 'cancelled'])
];
const getRoutesValidation = [
    (0, express_validator_1.query)('page').optional().isNumeric().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isNumeric().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)('status').optional().isIn(['draft', 'active', 'completed', 'cancelled']),
    (0, express_validator_1.query)('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    (0, express_validator_1.query)('collectorId').optional().notEmpty(),
    (0, express_validator_1.query)('startDate').optional().isISO8601(),
    (0, express_validator_1.query)('endDate').optional().isISO8601()
];
router.get('/', getRoutesValidation, validateRequest_1.validateRequest, auth_1.authenticate, routeController_1.RouteController.getRoutes);
router.get('/:id', auth_1.authenticate, routeController_1.RouteController.getRouteById);
router.post('/', createRouteValidation, validateRequest_1.validateRequest, auth_1.authenticate, (0, auth_1.authorize)('admin', 'municipal_officer'), routeController_1.RouteController.createRoute);
router.put('/:id', updateRouteValidation, validateRequest_1.validateRequest, auth_1.authenticate, routeController_1.RouteController.updateRoute);
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('admin'), routeController_1.RouteController.deleteRoute);
router.post('/optimize-direct', auth_1.authenticate, routeController_1.RouteController.optimizeRouteDirect);
router.post('/:id/optimize', auth_1.authenticate, routeController_1.RouteController.optimizeRoute);
router.post('/:id/start', auth_1.authenticate, routeController_1.RouteController.startRoute);
router.post('/:id/complete', auth_1.authenticate, routeController_1.RouteController.completeRoute);
router.post('/:id/bins/:binId/visit', auth_1.authenticate, routeController_1.RouteController.markBinVisited);
router.post('/:id/bins/:binId/skip', auth_1.authenticate, routeController_1.RouteController.markBinSkipped);
exports.default = router;
//# sourceMappingURL=routes.js.map