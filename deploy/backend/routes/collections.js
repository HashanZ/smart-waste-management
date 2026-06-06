"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const collectionController_1 = require("../controllers/collectionController");
const validateRequest_1 = require("../middleware/validateRequest");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const createCollectionValidation = [
    (0, express_validator_1.body)('binId').notEmpty(),
    (0, express_validator_1.body)('collectorId').notEmpty(),
    (0, express_validator_1.body)('collectionDate').isISO8601(),
    (0, express_validator_1.body)('wasteType').isIn(['general', 'recyclable', 'organic', 'hazardous']),
    (0, express_validator_1.body)('collectionMethod').optional().isIn(['manual', 'automated']),
    (0, express_validator_1.body)('notes').optional().isLength({ max: 500 })
];
const updateCollectionValidation = [
    (0, express_validator_1.body)('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled']),
    (0, express_validator_1.body)('actualCollectionTime').optional().isISO8601(),
    (0, express_validator_1.body)('notes').optional().isLength({ max: 500 }),
    (0, express_validator_1.body)('weight').optional().isNumeric().isFloat({ min: 0 }),
    (0, express_validator_1.body)('volume').optional().isNumeric().isFloat({ min: 0 }),
    (0, express_validator_1.body)('qualityScore').optional().isNumeric().isFloat({ min: 1, max: 10 }),
    (0, express_validator_1.body)('issues').optional().isArray()
];
const getCollectionsValidation = [
    (0, express_validator_1.query)('page').optional().isNumeric().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isNumeric().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled']),
    (0, express_validator_1.query)('wasteType').optional().isIn(['general', 'recyclable', 'organic', 'hazardous']),
    (0, express_validator_1.query)('startDate').optional().isISO8601(),
    (0, express_validator_1.query)('endDate').optional().isISO8601()
];
router.get('/', getCollectionsValidation, validateRequest_1.validateRequest, auth_1.authenticate, collectionController_1.CollectionController.getCollections);
router.get('/:id', auth_1.authenticate, collectionController_1.CollectionController.getCollectionById);
router.post('/', createCollectionValidation, validateRequest_1.validateRequest, auth_1.authenticate, (0, auth_1.authorize)('admin', 'municipal_officer'), collectionController_1.CollectionController.createCollection);
router.put('/:id', updateCollectionValidation, validateRequest_1.validateRequest, auth_1.authenticate, collectionController_1.CollectionController.updateCollection);
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('admin'), collectionController_1.CollectionController.deleteCollection);
router.post('/:id/complete', auth_1.authenticate, collectionController_1.CollectionController.completeCollection);
router.post('/:id/cancel', auth_1.authenticate, collectionController_1.CollectionController.cancelCollection);
exports.default = router;
//# sourceMappingURL=collections.js.map