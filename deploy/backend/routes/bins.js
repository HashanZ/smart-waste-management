"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const binController_1 = require("../controllers/binController");
const validateRequest_1 = require("../middleware/validateRequest");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const createBinValidation = [
    (0, express_validator_1.body)("binId").notEmpty().trim(),
    (0, express_validator_1.body)("location.latitude").isNumeric().isFloat({ min: -90, max: 90 }),
    (0, express_validator_1.body)("location.longitude").isNumeric().isFloat({ min: -180, max: 180 }),
    (0, express_validator_1.body)("location.address").optional().trim(),
    (0, express_validator_1.body)("capacity")
        .isNumeric()
        .isFloat({ min: 1 })
        .withMessage("Capacity must be greater than 0"),
    (0, express_validator_1.body)("currentLevel").optional().isNumeric().isFloat({ min: 0, max: 100 }),
    (0, express_validator_1.body)("binType").isIn(["general", "recyclable", "organic", "hazardous"]),
    (0, express_validator_1.body)("status").optional().isIn(["active", "inactive", "maintenance", "full"]),
    (0, express_validator_1.body)("collectionFrequency").optional().isNumeric().isInt({ min: 1 }),
];
const updateBinValidation = [
    (0, express_validator_1.body)("binId").optional().trim(),
    (0, express_validator_1.body)("location.latitude")
        .optional()
        .isNumeric()
        .isFloat({ min: -90, max: 90 }),
    (0, express_validator_1.body)("location.longitude")
        .optional()
        .isNumeric()
        .isFloat({ min: -180, max: 180 }),
    (0, express_validator_1.body)("location.address").optional().trim(),
    (0, express_validator_1.body)("capacity").optional().isNumeric().isFloat({ min: 0 }),
    (0, express_validator_1.body)("currentLevel").optional().isNumeric().isFloat({ min: 0, max: 100 }),
    (0, express_validator_1.body)("binType")
        .optional()
        .isIn(["general", "recyclable", "organic", "hazardous"]),
    (0, express_validator_1.body)("status").optional().isIn(["active", "inactive", "maintenance", "full"]),
    (0, express_validator_1.body)("collectionFrequency").optional().isNumeric().isInt({ min: 1 }),
];
const updateBinDataValidation = [
    (0, express_validator_1.body)("currentLevel").isNumeric().isFloat({ min: 0, max: 100 }),
    (0, express_validator_1.body)("temperature").optional().isNumeric(),
    (0, express_validator_1.body)("humidity").optional().isNumeric().isFloat({ min: 0, max: 100 }),
    (0, express_validator_1.body)("batteryLevel").optional().isNumeric().isFloat({ min: 0, max: 100 }),
    (0, express_validator_1.body)("signalStrength").optional().isNumeric(),
];
const getBinsValidation = [
    (0, express_validator_1.query)("page").optional().isNumeric().isInt({ min: 1 }),
    (0, express_validator_1.query)("limit").optional().isNumeric().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)("binType")
        .optional()
        .isIn(["general", "recyclable", "organic", "hazardous"]),
    (0, express_validator_1.query)("status").optional().isIn(["active", "maintenance", "inactive"]),
    (0, express_validator_1.query)("isOverflowing").optional().isBoolean(),
    (0, express_validator_1.query)("latitude").optional().isNumeric(),
    (0, express_validator_1.query)("longitude").optional().isNumeric(),
    (0, express_validator_1.query)("radius").optional().isNumeric().isFloat({ min: 0, max: 10000 }),
];
router.get("/", getBinsValidation, validateRequest_1.validateRequest, auth_1.authenticate, binController_1.BinController.getBins);
router.get("/:id", auth_1.authenticate, binController_1.BinController.getBinById);
router.post("/", createBinValidation, validateRequest_1.validateRequest, auth_1.authenticate, (0, auth_1.authorize)("admin", "municipal_officer"), binController_1.BinController.createBin);
router.put("/:id", updateBinValidation, validateRequest_1.validateRequest, auth_1.authenticate, (0, auth_1.authorize)("admin", "municipal_officer"), binController_1.BinController.updateBin);
router.delete("/:id", auth_1.authenticate, (0, auth_1.authorize)("admin"), binController_1.BinController.deleteBin);
router.put("/:id/data", updateBinDataValidation, validateRequest_1.validateRequest, auth_1.authenticate, binController_1.BinController.updateBinData);
router.get("/:id/history", auth_1.authenticate, binController_1.BinController.getBinHistory);
router.post("/:id/maintenance", auth_1.authenticate, (0, auth_1.authorize)("admin", "municipal_officer"), binController_1.BinController.scheduleMaintenance);
router.post("/iot/update", binController_1.BinController.updateBinDataIoT);
exports.default = router;
//# sourceMappingURL=bins.js.map