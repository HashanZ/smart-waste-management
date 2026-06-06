import { Router } from "express";
import { body, query } from "express-validator";
import { BinController } from "@/controllers/binController";
import { validateRequest } from "@/middleware/validateRequest";
import { authenticate, authorize } from "@/middleware/auth";

const router = Router();

// Validation rules
const createBinValidation = [
  body("binId").notEmpty().trim(),
  body("location.latitude").isNumeric().isFloat({ min: -90, max: 90 }),
  body("location.longitude").isNumeric().isFloat({ min: -180, max: 180 }),
  body("location.address").optional().trim(),
  body("capacity")
    .isNumeric()
    .isFloat({ min: 1 })
    .withMessage("Capacity must be greater than 0"),
  body("currentLevel").optional().isNumeric().isFloat({ min: 0, max: 100 }),
  body("binType").isIn(["general", "recyclable", "organic", "hazardous"]),
  body("status").optional().isIn(["active", "inactive", "maintenance", "full"]),
  body("collectionFrequency").optional().isNumeric().isInt({ min: 1 }),
];

const updateBinValidation = [
  body("binId").optional().trim(),
  body("location.latitude")
    .optional()
    .isNumeric()
    .isFloat({ min: -90, max: 90 }),
  body("location.longitude")
    .optional()
    .isNumeric()
    .isFloat({ min: -180, max: 180 }),
  body("location.address").optional().trim(),
  body("capacity").optional().isNumeric().isFloat({ min: 0 }),
  body("currentLevel").optional().isNumeric().isFloat({ min: 0, max: 100 }),
  body("binType")
    .optional()
    .isIn(["general", "recyclable", "organic", "hazardous"]),
  body("status").optional().isIn(["active", "inactive", "maintenance", "full"]),
  body("collectionFrequency").optional().isNumeric().isInt({ min: 1 }),
];

const updateBinDataValidation = [
  body("currentLevel").isNumeric().isFloat({ min: 0, max: 100 }),
  body("temperature").optional().isNumeric(),
  body("humidity").optional().isNumeric().isFloat({ min: 0, max: 100 }),
  body("batteryLevel").optional().isNumeric().isFloat({ min: 0, max: 100 }),
  body("signalStrength").optional().isNumeric(),
];

const getBinsValidation = [
  query("page").optional().isNumeric().isInt({ min: 1 }),
  query("limit").optional().isNumeric().isInt({ min: 1, max: 100 }),
  query("binType")
    .optional()
    .isIn(["general", "recyclable", "organic", "hazardous"]),
  query("status").optional().isIn(["active", "maintenance", "inactive"]),
  query("isOverflowing").optional().isBoolean(),
  query("latitude").optional().isNumeric(),
  query("longitude").optional().isNumeric(),
  query("radius").optional().isNumeric().isFloat({ min: 0, max: 10000 }),
];

// Routes
router.get(
  "/",
  getBinsValidation,
  validateRequest,
  authenticate,
  BinController.getBins,
);
router.get("/:id", authenticate, BinController.getBinById);
router.post(
  "/",
  createBinValidation,
  validateRequest,
  authenticate,
  authorize("admin", "municipal_officer"),
  BinController.createBin,
);
router.put(
  "/:id",
  updateBinValidation,
  validateRequest,
  authenticate,
  authorize("admin", "municipal_officer"),
  BinController.updateBin,
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  BinController.deleteBin,
);
router.put(
  "/:id/data",
  updateBinDataValidation,
  validateRequest,
  authenticate,
  BinController.updateBinData,
);
router.get("/:id/history", authenticate, BinController.getBinHistory);
router.post(
  "/:id/maintenance",
  authenticate,
  authorize("admin", "municipal_officer"),
  BinController.scheduleMaintenance,
);

// IoT endpoint - no authentication required (uses binId in body)
router.post("/iot/update", BinController.updateBinDataIoT);

export default router;
