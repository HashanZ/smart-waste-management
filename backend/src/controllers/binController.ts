import { Request, Response } from "express";
import { ResponseHandler } from "@/utils/response";
import { logger } from "@/utils/logger";
import { SocketService } from "@/services/socketService";
import { Bin } from "@/models/Bin";
import { Collection } from "@/models/Collection";
import { Prediction } from "@/models/Prediction";

export class BinController {
  static async getBins(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        binType,
        isOverflowing,
      } = req.query;

      // Build filter object
      const filter: any = {};
      if (status) filter.status = status;
      if (binType) filter.binType = binType;
      if (isOverflowing !== undefined)
        filter.isOverflowing = isOverflowing === "true";

      // Calculate pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Get bins with pagination and total counts
      const [bins, total, activeCount, overflowingCount] = await Promise.all([
        Bin.find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Bin.countDocuments(filter),
        // Get total active bins (regardless of current filter)
        Bin.countDocuments({ status: "active" }),
        // Get total overflowing bins (regardless of current filter)
        Bin.countDocuments({
          $or: [
            { isOverflowing: true },
            { status: "overflowing" },
            { currentLevel: { $gte: 90 } },
          ],
        }),
      ]);

      // Get latest predictions for each bin
      const binIds = bins.map((bin) => bin.binId);
      const predictions = await Prediction.find({ binId: { $in: binIds } })
        .sort({ createdAt: -1 })
        .lean();

      // Group predictions by binId (get latest for each bin)
      const predictionMap = new Map<string, any>();
      for (const pred of predictions) {
        if (!predictionMap.has(pred.binId)) {
          predictionMap.set(pred.binId, pred);
        }
      }

      // Attach predictions to bins
      const binsWithPredictions = bins.map((bin) => ({
        ...bin,
        prediction: predictionMap.get(bin.binId) || null,
      }));

      // Include total counts in pagination metadata
      ResponseHandler.paginated(
        res,
        binsWithPredictions,
        {
          page: pageNum,
          limit: limitNum,
          total,
        },
        {
          // Additional metadata with total counts from database
          activeBins: activeCount,
          overflowingBins: overflowingCount,
        } as any,
      );
    } catch (error) {
      logger.error("Get bins error:", error);
      ResponseHandler.error(res, "Failed to get bins");
    }
  }

  static async getBinById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, "Invalid bin ID format", 400);
        return;
      }

      const bin = await Bin.findById(id).lean();
      if (!bin) {
        ResponseHandler.error(res, "Bin not found", 404);
        return;
      }

      ResponseHandler.success(res, bin, "Bin retrieved successfully");
    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === "CastError") {
        ResponseHandler.error(res, "Invalid bin ID format", 400);
        return;
      }

      logger.error("Get bin by ID error:", error);
      ResponseHandler.error(res, "Failed to get bin", 500);
    }
  }

  static async createBin(req: Request, res: Response): Promise<void> {
    try {
      const binData = req.body;

      // Validate binId is a string (not array, object, etc.)
      if (binData.binId !== undefined) {
        if (typeof binData.binId !== "string") {
          ResponseHandler.error(res, "binId must be a string", 400);
          return;
        }
      }

      // Check if binId already exists
      if (binData.binId) {
        const existingBin = await Bin.findOne({ binId: binData.binId });
        if (existingBin) {
          ResponseHandler.error(res, "Bin ID already exists", 409);
          return;
        }
      }

      // Add MongoDB validator required fields
      // MongoDB validator expects 'type' (not just 'binType') and 'location.coordinates'
      if (binData.binType && !binData.type) {
        binData.type = binData.binType;
      }
      if (
        binData.location?.latitude !== undefined &&
        binData.location?.longitude !== undefined &&
        !binData.location?.coordinates
      ) {
        binData.location.coordinates = [
          binData.location.longitude,
          binData.location.latitude,
        ]; // GeoJSON format: [lon, lat]
      }

      const bin = await Bin.create(binData);

      logger.info(`Bin created: ${bin.binId}`, { binId: bin._id });

      // Emit real-time update (don't let socket errors crash the request)
      try {
        SocketService.emitBinUpdate(bin);
      } catch (socketError) {
        logger.warn("Failed to emit bin update via socket", {
          error: socketError,
        });
      }

      ResponseHandler.success(res, bin, "Bin created successfully", 201);
    } catch (error) {
      logger.error("Create bin error:", error);
      logger.error("Error type:", typeof error);
      logger.error("Error name:", (error as any)?.name);
      logger.error("Error errors:", (error as any)?.errors);

      let errorMessage = "Failed to create bin";

      if (error instanceof Error) {
        errorMessage = error.message;
        const errorObj = error as any;

        // Handle Mongoose validation errors
        if (errorObj.name === "ValidationError" && errorObj.errors) {
          const validationErrors = Object.values(errorObj.errors).map(
            (err: any) => `${err.path}: ${err.message}`,
          );
          errorMessage = `Validation failed: ${validationErrors.join(", ")}`;
          logger.error("Validation errors:", validationErrors);
        }
        // Handle MongoServerError
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
          logger.error("MongoServerError details:", {
            code: errorObj.code,
            codeName: errorObj.codeName,
            errInfo: errorObj.errInfo,
            writeErrors: errorObj.writeErrors,
          });
        }
        // Handle other Mongoose errors
        else if (errorObj.name && errorObj.message) {
          errorMessage = `${errorObj.name}: ${errorObj.message}`;
          if (errorObj.errors) {
            const details = Object.values(errorObj.errors)
              .map((err: any) => err.message || err)
              .join(", ");
            errorMessage += ` (${details})`;
          }
        }
      }

      const errorDetails =
        process.env["NODE_ENV"] === "development"
          ? errorMessage
          : "Failed to create bin";
      ResponseHandler.error(res, errorDetails, 500, errorMessage);
    }
  }

  static async updateBin(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, "Invalid bin ID format", 400);
        return;
      }

      // Check if binId is being updated and if it already exists
      if (updateData.binId) {
        const existingBin = await Bin.findOne({
          binId: updateData.binId,
          _id: { $ne: id },
        });
        if (existingBin) {
          ResponseHandler.error(res, "Bin ID already exists", 409);
          return;
        }
      }

      const bin = await Bin.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!bin) {
        ResponseHandler.error(res, "Bin not found", 404);
        return;
      }

      // Emit real-time update
      SocketService.emitBinUpdate(bin);

      logger.info(`Bin updated: ${bin.binId}`, { binId: bin._id });

      ResponseHandler.success(res, bin, "Bin updated successfully");
    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === "CastError") {
        ResponseHandler.error(res, "Invalid bin ID format", 400);
        return;
      }

      logger.error("Update bin error:", error);
      ResponseHandler.error(res, "Failed to update bin", 500);
    }
  }

  static async deleteBin(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, "Invalid bin ID format", 400);
        return;
      }

      const bin = await Bin.findByIdAndDelete(id);
      if (!bin) {
        ResponseHandler.error(res, "Bin not found", 404);
        return;
      }

      logger.info(`Bin deleted: ${bin.binId}`, { binId: bin._id });

      // Emit real-time update
      SocketService.emitBinDeletion(bin._id.toString());

      ResponseHandler.success(res, null, "Bin deleted successfully");
    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === "CastError") {
        ResponseHandler.error(res, "Invalid bin ID format", 400);
        return;
      }

      logger.error("Delete bin error:", error);
      ResponseHandler.error(res, "Failed to delete bin", 500);
    }
  }

  static async updateBinData(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, "Invalid bin ID format", 400);
        return;
      }

      const bin = await Bin.findByIdAndUpdate(
        id,
        {
          ...data,
          updatedAt: new Date(),
        },
        { new: true, runValidators: true },
      );

      if (!bin) {
        ResponseHandler.error(res, "Bin not found", 404);
        return;
      }

      // Check if bin is overflowing and add alert if needed
      if (bin.currentLevel >= 90 && !bin.isOverflowing) {
        bin.isOverflowing = true;
        const newAlert = {
          type: "overflow" as const,
          message: `Bin ${bin.binId} is overflowing at ${bin.currentLevel}%`,
          timestamp: new Date(),
          resolved: false,
        };
        bin.alerts.push(newAlert);
        await bin.save();

        // Emit alert via WebSocket
        try {
          SocketService.emitAlert({
            type: "overflow",
            binId: bin.binId,
            message: newAlert.message,
            severity: "high",
            location: bin.location,
            timestamp: newAlert.timestamp,
            currentLevel: bin.currentLevel,
          });
          logger.warn(`Overflow alert emitted for bin ${bin.binId}`, {
            level: bin.currentLevel,
            location: bin.location,
          });
        } catch (alertError: any) {
          logger.error("Failed to emit overflow alert via socket", {
            error: alertError,
          });
        }
      } else if (bin.currentLevel < 90 && bin.isOverflowing) {
        bin.isOverflowing = false;
        // Mark overflow alerts as resolved
        bin.alerts.forEach((alert) => {
          if (alert.type === "overflow" && !alert.resolved) {
            alert.resolved = true;
          }
        });
        await bin.save();
      }

      // Emit real-time update
      try {
        SocketService.emitBinUpdate(bin);
        logger.info(
          `Bin data updated and WebSocket event emitted: ${bin.binId}`,
          {
            fillLevel: bin.currentLevel,
            isOverflowing: bin.isOverflowing,
            binId: bin._id,
          },
        );
      } catch (socketError: any) {
        logger.error("Failed to emit bin update via socket", {
          error: socketError,
        });
      }

      logger.info(`Bin data updated: ${bin.binId}`, {
        fillLevel: bin.currentLevel,
        isOverflowing: bin.isOverflowing,
      });

      ResponseHandler.success(res, bin, "Bin data updated successfully");
    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === "CastError") {
        ResponseHandler.error(res, "Invalid bin ID format", 400);
        return;
      }

      logger.error("Update bin data error:", error);
      ResponseHandler.error(res, "Failed to update bin data", 500);
    }
  }

  /**
   * IoT endpoint for updating bin data via binId (no authentication required)
   * Used by ESP32 and other IoT devices
   */
  static async updateBinDataIoT(req: Request, res: Response): Promise<void> {
    try {
      const { binId, fillLevel, batteryLevel, signalStrength } = req.body;

      // Validate required fields
      if (!binId) {
        ResponseHandler.error(res, "binId is required", 400);
        return;
      }

      if (fillLevel === undefined || fillLevel === null) {
        ResponseHandler.error(res, "fillLevel is required", 400);
        return;
      }

      // Validate fill level range
      if (fillLevel < 0 || fillLevel > 100) {
        ResponseHandler.error(res, "fillLevel must be between 0 and 100", 400);
        return;
      }

      // Find bin by binId
      const bin = await Bin.findOne({ binId });

      if (!bin) {
        ResponseHandler.error(res, `Bin with binId ${binId} not found`, 404);
        return;
      }

      // Update bin data
      bin.currentLevel = fillLevel;
      if (batteryLevel !== undefined) {
        bin.metadata.batteryLevel = batteryLevel;
      }
      if (signalStrength !== undefined) {
        bin.metadata.signalStrength = signalStrength;
      }
      bin.metadata.lastDataReceived = new Date();
      bin.updatedAt = new Date();

      // Check if bin is overflowing and add alert if needed
      if (bin.currentLevel >= 90 && !bin.isOverflowing) {
        bin.isOverflowing = true;
        bin.status = "full";
        const newAlert = {
          type: "overflow" as const,
          message: `Bin ${bin.binId} is overflowing at ${bin.currentLevel}%`,
          timestamp: new Date(),
          resolved: false,
        };
        bin.alerts.push(newAlert);

        // Emit alert via WebSocket
        try {
          SocketService.emitAlert({
            type: "overflow",
            binId: bin.binId,
            message: newAlert.message,
            severity: "high",
            location: bin.location,
            timestamp: newAlert.timestamp,
            currentLevel: bin.currentLevel,
          });
          logger.warn(`Overflow alert emitted for bin ${bin.binId}`, {
            level: bin.currentLevel,
            location: bin.location,
          });
        } catch (alertError: any) {
          logger.error("Failed to emit overflow alert via socket", {
            error: alertError,
          });
        }
      } else if (bin.currentLevel < 85 && bin.isOverflowing) {
        bin.isOverflowing = false;
        if (bin.status === "full") {
          bin.status = "active";
        }
        // Mark overflow alerts as resolved
        bin.alerts.forEach((alert) => {
          if (alert.type === "overflow" && !alert.resolved) {
            alert.resolved = true;
          }
        });
      }

      // Check for low battery condition
      if (batteryLevel !== undefined && batteryLevel < 20) {
        const hasLowBatteryAlert = bin.alerts.some(
          (alert) =>
            alert.type === "maintenance" &&
            alert.message.includes("battery") &&
            !alert.resolved,
        );

        if (!hasLowBatteryAlert) {
          bin.alerts.push({
            type: "maintenance",
            message: `Bin ${bin.binId} has low battery: ${batteryLevel}%`,
            timestamp: new Date(),
            resolved: false,
          });

          // Emit maintenance alert
          try {
            SocketService.emitAlert({
              type: "maintenance",
              binId: bin.binId,
              batteryLevel: batteryLevel,
              timestamp: new Date(),
              message: `Bin ${bin.binId} requires battery maintenance`,
            });
          } catch (alertError: any) {
            logger.error("Failed to emit battery alert via socket", {
              error: alertError,
            });
          }
        }
      }

      // Check for poor signal strength
      if (signalStrength !== undefined && signalStrength < 30) {
        const hasPoorSignalAlert = bin.alerts.some(
          (alert) => alert.type === "offline" && !alert.resolved,
        );

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

      // Emit real-time update
      try {
        SocketService.emitBinUpdate(bin);
        logger.info(`Bin data updated via IoT: ${bin.binId}`, {
          fillLevel: bin.currentLevel,
          batteryLevel: bin.metadata.batteryLevel,
          signalStrength: bin.metadata.signalStrength,
        });
      } catch (socketError: any) {
        logger.error("Failed to emit bin update via socket", {
          error: socketError,
        });
      }

      ResponseHandler.success(
        res,
        {
          binId: bin.binId,
          fillLevel: bin.currentLevel,
          batteryLevel: bin.metadata.batteryLevel,
          signalStrength: bin.metadata.signalStrength,
          isOverflowing: bin.isOverflowing,
        },
        "Bin data updated successfully",
      );
    } catch (error: any) {
      logger.error("Update bin data IoT error:", error);
      ResponseHandler.error(res, "Failed to update bin data", 500);
    }
  }

  static async getBinHistory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, "Invalid bin ID format", 400);
        return;
      }

      // Verify bin exists
      const bin = await Bin.findById(id);
      if (!bin) {
        ResponseHandler.error(res, "Bin not found", 404);
        return;
      }

      // Calculate pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Get collection history for this bin
      const [collections, total] = await Promise.all([
        Collection.find({ binId: id })
          .sort({ collectionDate: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Collection.countDocuments({ binId: id }),
      ]);

      ResponseHandler.paginated(res, collections, {
        page: pageNum,
        limit: limitNum,
        total,
      });
    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === "CastError") {
        ResponseHandler.error(res, "Invalid bin ID format", 400);
        return;
      }

      logger.error("Get bin history error:", error);
      ResponseHandler.error(res, "Failed to get bin history", 500);
    }
  }

  static async scheduleMaintenance(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, "Invalid bin ID format", 400);
        return;
      }

      const bin = await Bin.findByIdAndUpdate(
        id,
        {
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
        },
        { new: true, runValidators: true },
      );

      if (!bin) {
        ResponseHandler.error(res, "Bin not found", 404);
        return;
      }

      // Emit real-time update
      SocketService.emitBinUpdate(bin);

      logger.info(`Maintenance scheduled for bin: ${bin.binId}`, {
        notes,
        binId: bin._id,
      });

      ResponseHandler.success(res, bin, "Maintenance scheduled successfully");
    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === "CastError") {
        ResponseHandler.error(res, "Invalid bin ID format", 400);
        return;
      }

      logger.error("Schedule maintenance error:", error);
      ResponseHandler.error(res, "Failed to schedule maintenance", 500);
    }
  }
}
