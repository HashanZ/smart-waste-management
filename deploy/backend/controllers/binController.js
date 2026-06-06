"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinController = void 0;
const response_1 = require("../utils/response");
const logger_1 = require("../utils/logger");
const socketService_1 = require("../services/socketService");
const Bin_1 = require("../models/Bin");
const Collection_1 = require("../models/Collection");
const Prediction_1 = require("../models/Prediction");
class BinController {
    static async getBins(req, res) {
        try {
            const { page = 1, limit = 10, status, binType, isOverflowing, } = req.query;
            const filter = {};
            if (status)
                filter.status = status;
            if (binType)
                filter.binType = binType;
            if (isOverflowing !== undefined)
                filter.isOverflowing = isOverflowing === "true";
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const skip = (pageNum - 1) * limitNum;
            const [bins, total, activeCount, overflowingCount] = await Promise.all([
                Bin_1.Bin.find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                Bin_1.Bin.countDocuments(filter),
                Bin_1.Bin.countDocuments({ status: "active" }),
                Bin_1.Bin.countDocuments({
                    $or: [
                        { isOverflowing: true },
                        { status: "overflowing" },
                        { currentLevel: { $gte: 90 } },
                    ],
                }),
            ]);
            const binIds = bins.map((bin) => bin.binId);
            const predictions = await Prediction_1.Prediction.find({ binId: { $in: binIds } })
                .sort({ createdAt: -1 })
                .lean();
            const predictionMap = new Map();
            for (const pred of predictions) {
                if (!predictionMap.has(pred.binId)) {
                    predictionMap.set(pred.binId, pred);
                }
            }
            const binsWithPredictions = bins.map((bin) => ({
                ...bin,
                prediction: predictionMap.get(bin.binId) || null,
            }));
            response_1.ResponseHandler.paginated(res, binsWithPredictions, {
                page: pageNum,
                limit: limitNum,
                total,
            }, {
                activeBins: activeCount,
                overflowingBins: overflowingCount,
            });
        }
        catch (error) {
            logger_1.logger.error("Get bins error:", error);
            response_1.ResponseHandler.error(res, "Failed to get bins");
        }
    }
    static async getBinById(req, res) {
        try {
            const { id } = req.params;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, "Invalid bin ID format", 400);
                return;
            }
            const bin = await Bin_1.Bin.findById(id).lean();
            if (!bin) {
                response_1.ResponseHandler.error(res, "Bin not found", 404);
                return;
            }
            response_1.ResponseHandler.success(res, bin, "Bin retrieved successfully");
        }
        catch (error) {
            if (error.name === "CastError") {
                response_1.ResponseHandler.error(res, "Invalid bin ID format", 400);
                return;
            }
            logger_1.logger.error("Get bin by ID error:", error);
            response_1.ResponseHandler.error(res, "Failed to get bin", 500);
        }
    }
    static async createBin(req, res) {
        try {
            const binData = req.body;
            if (binData.binId !== undefined) {
                if (typeof binData.binId !== "string") {
                    response_1.ResponseHandler.error(res, "binId must be a string", 400);
                    return;
                }
            }
            if (binData.binId) {
                const existingBin = await Bin_1.Bin.findOne({ binId: binData.binId });
                if (existingBin) {
                    response_1.ResponseHandler.error(res, "Bin ID already exists", 409);
                    return;
                }
            }
            if (binData.binType && !binData.type) {
                binData.type = binData.binType;
            }
            if (binData.location?.latitude !== undefined &&
                binData.location?.longitude !== undefined &&
                !binData.location?.coordinates) {
                binData.location.coordinates = [
                    binData.location.longitude,
                    binData.location.latitude,
                ];
            }
            const bin = await Bin_1.Bin.create(binData);
            logger_1.logger.info(`Bin created: ${bin.binId}`, { binId: bin._id });
            try {
                socketService_1.SocketService.emitBinUpdate(bin);
            }
            catch (socketError) {
                logger_1.logger.warn("Failed to emit bin update via socket", {
                    error: socketError,
                });
            }
            response_1.ResponseHandler.success(res, bin, "Bin created successfully", 201);
        }
        catch (error) {
            logger_1.logger.error("Create bin error:", error);
            logger_1.logger.error("Error type:", typeof error);
            logger_1.logger.error("Error name:", error?.name);
            logger_1.logger.error("Error errors:", error?.errors);
            let errorMessage = "Failed to create bin";
            if (error instanceof Error) {
                errorMessage = error.message;
                const errorObj = error;
                if (errorObj.name === "ValidationError" && errorObj.errors) {
                    const validationErrors = Object.values(errorObj.errors).map((err) => `${err.path}: ${err.message}`);
                    errorMessage = `Validation failed: ${validationErrors.join(", ")}`;
                    logger_1.logger.error("Validation errors:", validationErrors);
                }
                else if (errorObj.name === "MongoServerError") {
                    errorMessage = errorObj.message;
                    if (errorObj.code) {
                        errorMessage += ` [Code: ${errorObj.code}]`;
                    }
                    if (errorObj.codeName) {
                        errorMessage += ` [CodeName: ${errorObj.codeName}]`;
                    }
                    if (errorObj.errInfo) {
                        errorMessage += ` [Details: ${JSON.stringify(errorObj.errInfo)}]`;
                    }
                    logger_1.logger.error("MongoServerError details:", {
                        code: errorObj.code,
                        codeName: errorObj.codeName,
                        errInfo: errorObj.errInfo,
                        writeErrors: errorObj.writeErrors,
                    });
                }
                else if (errorObj.name && errorObj.message) {
                    errorMessage = `${errorObj.name}: ${errorObj.message}`;
                    if (errorObj.errors) {
                        const details = Object.values(errorObj.errors)
                            .map((err) => err.message || err)
                            .join(", ");
                        errorMessage += ` (${details})`;
                    }
                }
            }
            const errorDetails = process.env["NODE_ENV"] === "development"
                ? errorMessage
                : "Failed to create bin";
            response_1.ResponseHandler.error(res, errorDetails, 500, errorMessage);
        }
    }
    static async updateBin(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, "Invalid bin ID format", 400);
                return;
            }
            if (updateData.binId) {
                const existingBin = await Bin_1.Bin.findOne({
                    binId: updateData.binId,
                    _id: { $ne: id },
                });
                if (existingBin) {
                    response_1.ResponseHandler.error(res, "Bin ID already exists", 409);
                    return;
                }
            }
            const bin = await Bin_1.Bin.findByIdAndUpdate(id, updateData, {
                new: true,
                runValidators: true,
            });
            if (!bin) {
                response_1.ResponseHandler.error(res, "Bin not found", 404);
                return;
            }
            socketService_1.SocketService.emitBinUpdate(bin);
            logger_1.logger.info(`Bin updated: ${bin.binId}`, { binId: bin._id });
            response_1.ResponseHandler.success(res, bin, "Bin updated successfully");
        }
        catch (error) {
            if (error.name === "CastError") {
                response_1.ResponseHandler.error(res, "Invalid bin ID format", 400);
                return;
            }
            logger_1.logger.error("Update bin error:", error);
            response_1.ResponseHandler.error(res, "Failed to update bin", 500);
        }
    }
    static async deleteBin(req, res) {
        try {
            const { id } = req.params;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, "Invalid bin ID format", 400);
                return;
            }
            const bin = await Bin_1.Bin.findByIdAndDelete(id);
            if (!bin) {
                response_1.ResponseHandler.error(res, "Bin not found", 404);
                return;
            }
            logger_1.logger.info(`Bin deleted: ${bin.binId}`, { binId: bin._id });
            socketService_1.SocketService.emitBinDeletion(bin._id.toString());
            response_1.ResponseHandler.success(res, null, "Bin deleted successfully");
        }
        catch (error) {
            if (error.name === "CastError") {
                response_1.ResponseHandler.error(res, "Invalid bin ID format", 400);
                return;
            }
            logger_1.logger.error("Delete bin error:", error);
            response_1.ResponseHandler.error(res, "Failed to delete bin", 500);
        }
    }
    static async updateBinData(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, "Invalid bin ID format", 400);
                return;
            }
            const bin = await Bin_1.Bin.findByIdAndUpdate(id, {
                ...data,
                updatedAt: new Date(),
            }, { new: true, runValidators: true });
            if (!bin) {
                response_1.ResponseHandler.error(res, "Bin not found", 404);
                return;
            }
            if (bin.currentLevel >= 90 && !bin.isOverflowing) {
                bin.isOverflowing = true;
                const newAlert = {
                    type: "overflow",
                    message: `Bin ${bin.binId} is overflowing at ${bin.currentLevel}%`,
                    timestamp: new Date(),
                    resolved: false,
                };
                bin.alerts.push(newAlert);
                await bin.save();
                try {
                    socketService_1.SocketService.emitAlert({
                        type: "overflow",
                        binId: bin.binId,
                        message: newAlert.message,
                        severity: "high",
                        location: bin.location,
                        timestamp: newAlert.timestamp,
                        currentLevel: bin.currentLevel,
                    });
                    logger_1.logger.warn(`Overflow alert emitted for bin ${bin.binId}`, {
                        level: bin.currentLevel,
                        location: bin.location,
                    });
                }
                catch (alertError) {
                    logger_1.logger.error("Failed to emit overflow alert via socket", {
                        error: alertError,
                    });
                }
            }
            else if (bin.currentLevel < 90 && bin.isOverflowing) {
                bin.isOverflowing = false;
                bin.alerts.forEach((alert) => {
                    if (alert.type === "overflow" && !alert.resolved) {
                        alert.resolved = true;
                    }
                });
                await bin.save();
            }
            try {
                socketService_1.SocketService.emitBinUpdate(bin);
                logger_1.logger.info(`Bin data updated and WebSocket event emitted: ${bin.binId}`, {
                    fillLevel: bin.currentLevel,
                    isOverflowing: bin.isOverflowing,
                    binId: bin._id,
                });
            }
            catch (socketError) {
                logger_1.logger.error("Failed to emit bin update via socket", {
                    error: socketError,
                });
            }
            logger_1.logger.info(`Bin data updated: ${bin.binId}`, {
                fillLevel: bin.currentLevel,
                isOverflowing: bin.isOverflowing,
            });
            response_1.ResponseHandler.success(res, bin, "Bin data updated successfully");
        }
        catch (error) {
            if (error.name === "CastError") {
                response_1.ResponseHandler.error(res, "Invalid bin ID format", 400);
                return;
            }
            logger_1.logger.error("Update bin data error:", error);
            response_1.ResponseHandler.error(res, "Failed to update bin data", 500);
        }
    }
    static async updateBinDataIoT(req, res) {
        try {
            const { binId, fillLevel, batteryLevel, signalStrength } = req.body;
            if (!binId) {
                response_1.ResponseHandler.error(res, "binId is required", 400);
                return;
            }
            if (fillLevel === undefined || fillLevel === null) {
                response_1.ResponseHandler.error(res, "fillLevel is required", 400);
                return;
            }
            if (fillLevel < 0 || fillLevel > 100) {
                response_1.ResponseHandler.error(res, "fillLevel must be between 0 and 100", 400);
                return;
            }
            const bin = await Bin_1.Bin.findOne({ binId });
            if (!bin) {
                response_1.ResponseHandler.error(res, `Bin with binId ${binId} not found`, 404);
                return;
            }
            bin.currentLevel = fillLevel;
            if (batteryLevel !== undefined) {
                bin.metadata.batteryLevel = batteryLevel;
            }
            if (signalStrength !== undefined) {
                bin.metadata.signalStrength = signalStrength;
            }
            bin.metadata.lastDataReceived = new Date();
            bin.updatedAt = new Date();
            if (bin.currentLevel >= 90 && !bin.isOverflowing) {
                bin.isOverflowing = true;
                bin.status = "full";
                const newAlert = {
                    type: "overflow",
                    message: `Bin ${bin.binId} is overflowing at ${bin.currentLevel}%`,
                    timestamp: new Date(),
                    resolved: false,
                };
                bin.alerts.push(newAlert);
                try {
                    socketService_1.SocketService.emitAlert({
                        type: "overflow",
                        binId: bin.binId,
                        message: newAlert.message,
                        severity: "high",
                        location: bin.location,
                        timestamp: newAlert.timestamp,
                        currentLevel: bin.currentLevel,
                    });
                    logger_1.logger.warn(`Overflow alert emitted for bin ${bin.binId}`, {
                        level: bin.currentLevel,
                        location: bin.location,
                    });
                }
                catch (alertError) {
                    logger_1.logger.error("Failed to emit overflow alert via socket", {
                        error: alertError,
                    });
                }
            }
            else if (bin.currentLevel < 85 && bin.isOverflowing) {
                bin.isOverflowing = false;
                if (bin.status === "full") {
                    bin.status = "active";
                }
                bin.alerts.forEach((alert) => {
                    if (alert.type === "overflow" && !alert.resolved) {
                        alert.resolved = true;
                    }
                });
            }
            if (batteryLevel !== undefined && batteryLevel < 20) {
                const hasLowBatteryAlert = bin.alerts.some((alert) => alert.type === "maintenance" &&
                    alert.message.includes("battery") &&
                    !alert.resolved);
                if (!hasLowBatteryAlert) {
                    bin.alerts.push({
                        type: "maintenance",
                        message: `Bin ${bin.binId} has low battery: ${batteryLevel}%`,
                        timestamp: new Date(),
                        resolved: false,
                    });
                    try {
                        socketService_1.SocketService.emitAlert({
                            type: "maintenance",
                            binId: bin.binId,
                            batteryLevel: batteryLevel,
                            timestamp: new Date(),
                            message: `Bin ${bin.binId} requires battery maintenance`,
                        });
                    }
                    catch (alertError) {
                        logger_1.logger.error("Failed to emit battery alert via socket", {
                            error: alertError,
                        });
                    }
                }
            }
            if (signalStrength !== undefined && signalStrength < 30) {
                const hasPoorSignalAlert = bin.alerts.some((alert) => alert.type === "offline" && !alert.resolved);
                if (!hasPoorSignalAlert) {
                    bin.alerts.push({
                        type: "offline",
                        message: `Bin ${bin.binId} has poor signal: ${signalStrength}%`,
                        timestamp: new Date(),
                        resolved: false,
                    });
                }
            }
            await bin.save();
            try {
                socketService_1.SocketService.emitBinUpdate(bin);
                logger_1.logger.info(`Bin data updated via IoT: ${bin.binId}`, {
                    fillLevel: bin.currentLevel,
                    batteryLevel: bin.metadata.batteryLevel,
                    signalStrength: bin.metadata.signalStrength,
                });
            }
            catch (socketError) {
                logger_1.logger.error("Failed to emit bin update via socket", {
                    error: socketError,
                });
            }
            response_1.ResponseHandler.success(res, {
                binId: bin.binId,
                fillLevel: bin.currentLevel,
                batteryLevel: bin.metadata.batteryLevel,
                signalStrength: bin.metadata.signalStrength,
                isOverflowing: bin.isOverflowing,
            }, "Bin data updated successfully");
        }
        catch (error) {
            logger_1.logger.error("Update bin data IoT error:", error);
            response_1.ResponseHandler.error(res, "Failed to update bin data", 500);
        }
    }
    static async getBinHistory(req, res) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 10 } = req.query;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, "Invalid bin ID format", 400);
                return;
            }
            const bin = await Bin_1.Bin.findById(id);
            if (!bin) {
                response_1.ResponseHandler.error(res, "Bin not found", 404);
                return;
            }
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const skip = (pageNum - 1) * limitNum;
            const [collections, total] = await Promise.all([
                Collection_1.Collection.find({ binId: id })
                    .sort({ collectionDate: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                Collection_1.Collection.countDocuments({ binId: id }),
            ]);
            response_1.ResponseHandler.paginated(res, collections, {
                page: pageNum,
                limit: limitNum,
                total,
            });
        }
        catch (error) {
            if (error.name === "CastError") {
                response_1.ResponseHandler.error(res, "Invalid bin ID format", 400);
                return;
            }
            logger_1.logger.error("Get bin history error:", error);
            response_1.ResponseHandler.error(res, "Failed to get bin history", 500);
        }
    }
    static async scheduleMaintenance(req, res) {
        try {
            const { id } = req.params;
            const { notes } = req.body;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, "Invalid bin ID format", 400);
                return;
            }
            const bin = await Bin_1.Bin.findByIdAndUpdate(id, {
                status: "maintenance",
                "metadata.lastMaintenance": new Date(),
                $push: {
                    alerts: {
                        type: "maintenance",
                        message: notes || "Maintenance scheduled",
                        timestamp: new Date(),
                        resolved: false,
                    },
                },
            }, { new: true, runValidators: true });
            if (!bin) {
                response_1.ResponseHandler.error(res, "Bin not found", 404);
                return;
            }
            socketService_1.SocketService.emitBinUpdate(bin);
            logger_1.logger.info(`Maintenance scheduled for bin: ${bin.binId}`, {
                notes,
                binId: bin._id,
            });
            response_1.ResponseHandler.success(res, bin, "Maintenance scheduled successfully");
        }
        catch (error) {
            if (error.name === "CastError") {
                response_1.ResponseHandler.error(res, "Invalid bin ID format", 400);
                return;
            }
            logger_1.logger.error("Schedule maintenance error:", error);
            response_1.ResponseHandler.error(res, "Failed to schedule maintenance", 500);
        }
    }
}
exports.BinController = BinController;
//# sourceMappingURL=binController.js.map