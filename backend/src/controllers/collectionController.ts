import { Request, Response } from 'express';
import { ResponseHandler } from '@/utils/response';
import { logger } from '@/utils/logger';
import { Collection } from '@/models/Collection';
import { Bin } from '@/models/Bin';
import { User } from '@/models/User';
import { SocketService } from '@/services/socketService';

export class CollectionController {
  static async getCollections(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        collectorId,
        binId,
        wasteType,
        startDate,
        endDate
      } = req.query;

      // Build filter object
      const filter: any = {};
      if (status) filter.status = status;
      if (collectorId) filter.collectorId = collectorId;
      if (binId) filter.binId = binId;
      if (wasteType) filter.wasteType = wasteType;

      if (startDate || endDate) {
        filter.scheduledDate = {};
        if (startDate) filter.scheduledDate.$gte = new Date(startDate as string);
        if (endDate) filter.scheduledDate.$lte = new Date(endDate as string);
      }

      // Calculate pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Get collections with pagination
      const [collections, total] = await Promise.all([
        Collection.find(filter)
          .sort({ scheduledDate: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Collection.countDocuments(filter)
      ]);

      ResponseHandler.paginated(res, collections, {
        page: pageNum,
        limit: limitNum,
        total
      });

    } catch (error) {
      logger.error('Get collections error:', error);
      ResponseHandler.error(res, 'Failed to get collections');
    }
  }

  static async getCollectionById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, 'Invalid collection ID format', 400);
        return;
      }

      const collection = await Collection.findById(id).lean();
      if (!collection) {
        ResponseHandler.error(res, 'Collection not found', 404);
        return;
      }

      ResponseHandler.success(res, collection, 'Collection retrieved successfully');

    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === 'CastError') {
        ResponseHandler.error(res, 'Invalid collection ID format', 400);
        return;
      }

      logger.error('Get collection by ID error:', error);
      ResponseHandler.error(res, 'Failed to get collection', 500);
    }
  }

  static async createCollection(req: Request, res: Response): Promise<void> {
    try {
      const collectionData = req.body;

      // Validate binId format first
      if (!collectionData.binId || !collectionData.binId.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, 'Invalid bin ID format', 400);
        return;
      }

      // Validate bin exists
      const bin = await Bin.findById(collectionData.binId).lean();
      if (!bin) {
        ResponseHandler.error(res, 'Bin not found', 404);
        return;
      }

      // Validate collector exists
      const collector = await User.findById(collectionData.collectorId).lean();
      if (!collector) {
        ResponseHandler.error(res, 'Collector not found', 404);
        return;
      }

      // Generate unique collectionId
      const collectionCount = await Collection.countDocuments();
      collectionData.collectionId = `COL${String(collectionCount + 1).padStart(6, '0')}`;

      // Add bin and collector details
      collectionData.bin = {
        binId: bin.binId,
        binType: bin.binType,
        location: bin.location
      };

      collectionData.collector = {
        firstName: collector.firstName,
        lastName: collector.lastName,
        email: collector.email
      };

      collectionData.wasteType = bin.binType;

      const collection = await Collection.create(collectionData);

      logger.info(`Collection created: ${collection.collectionId}`, {
        collectionId: collection._id,
        binId: bin.binId
      });

      // Emit real-time update
      SocketService.emitCollectionUpdate(collection);

      ResponseHandler.success(res, collection, 'Collection created successfully', 201);

    } catch (error: any) {
      logger.error('Create collection error:', error);

      // Handle validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors || {}).map((err: any) => err.message).join(', ');
        ResponseHandler.error(res, `Validation failed: ${validationErrors}`, 400);
        return;
      }

      // Handle CastError for invalid ObjectIds
      if (error.name === 'CastError') {
        ResponseHandler.error(res, `Invalid ID format: ${error.path || 'unknown'}`, 400);
        return;
      }

      ResponseHandler.error(res, 'Failed to create collection', 500);
    }
  }

  static async updateCollection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, 'Invalid collection ID format', 400);
        return;
      }

      const collection = await Collection.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!collection) {
        ResponseHandler.error(res, 'Collection not found', 404);
        return;
      }

      // Emit real-time update
      SocketService.emitCollectionUpdate(collection);

      logger.info(`Collection updated: ${collection.collectionId}`, {
        collectionId: collection._id
      });

      ResponseHandler.success(res, collection, 'Collection updated successfully');

    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === 'CastError') {
        ResponseHandler.error(res, 'Invalid collection ID format', 400);
        return;
      }

      logger.error('Update collection error:', error);
      ResponseHandler.error(res, 'Failed to update collection', 500);
    }
  }

  static async deleteCollection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, 'Invalid collection ID format', 400);
        return;
      }

      const collection = await Collection.findByIdAndDelete(id);
      if (!collection) {
        ResponseHandler.error(res, 'Collection not found', 404);
        return;
      }

      logger.info(`Collection deleted: ${collection.collectionId}`, {
        collectionId: collection._id
      });

      ResponseHandler.success(res, null, 'Collection deleted successfully');

    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === 'CastError') {
        ResponseHandler.error(res, 'Invalid collection ID format', 400);
        return;
      }

      logger.error('Delete collection error:', error);
      ResponseHandler.error(res, 'Failed to delete collection', 500);
    }
  }

  static async completeCollection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { weight, volume, notes, images } = req.body;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, 'Invalid collection ID format', 400);
        return;
      }

      const collection = await Collection.findById(id);
      if (!collection) {
        ResponseHandler.error(res, 'Collection not found', 404);
        return;
      }

      if (collection.status === 'completed') {
        ResponseHandler.error(res, 'Collection already completed', 400);
        return;
      }

      // Update collection status
      collection.status = 'completed';
      collection.actualDate = new Date();
      if (weight) collection.weight = weight;
      if (volume) collection.volume = volume;
      if (notes) collection.notes = notes;
      if (images) collection.images = images;

      await collection.save();

      // Update bin's lastEmptied date and reset fill level
      await Bin.findByIdAndUpdate(collection.binId, {
        lastEmptied: new Date(),
        currentLevel: 0, // Reset after collection
        nextCollection: null
      });

      logger.info(`Collection completed: ${collection.collectionId}`, {
        collectionId: collection._id,
        binId: collection.binId,
        weight,
        volume
      });

      // Emit real-time update
      SocketService.emitCollectionUpdate(collection);

      ResponseHandler.success(res, collection, 'Collection completed successfully');

    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === 'CastError') {
        ResponseHandler.error(res, 'Invalid collection ID format', 400);
        return;
      }

      logger.error('Complete collection error:', error);
      ResponseHandler.error(res, 'Failed to complete collection', 500);
    }
  }

  static async cancelCollection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, 'Invalid collection ID format', 400);
        return;
      }

      if (!reason) {
        ResponseHandler.error(res, 'Cancellation reason is required', 400);
        return;
      }

      const collection = await Collection.findById(id);
      if (!collection) {
        ResponseHandler.error(res, 'Collection not found', 404);
        return;
      }

      if (collection.status === 'completed') {
        ResponseHandler.error(res, 'Cannot cancel completed collection', 400);
        return;
      }

      collection.status = 'cancelled';
      collection.notes = reason;
      await collection.save();

      logger.info(`Collection cancelled: ${collection.collectionId}`, {
        collectionId: collection._id,
        reason
      });

      // Emit real-time update
      SocketService.emitCollectionUpdate(collection);

      ResponseHandler.success(res, collection, 'Collection cancelled successfully');

    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === 'CastError') {
        ResponseHandler.error(res, 'Invalid collection ID format', 400);
        return;
      }

      logger.error('Cancel collection error:', error);
      ResponseHandler.error(res, 'Failed to cancel collection', 500);
    }
  }

  static async getCollectionHistory(req: Request, res: Response): Promise<void> {
    try {
      const { binId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Verify bin exists
      const bin = await Bin.findById(binId);
      if (!bin) {
        ResponseHandler.error(res, 'Bin not found', 404);
        return;
      }

      // Calculate pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Get collection history for this bin
      const [collections, total] = await Promise.all([
        Collection.find({ binId })
          .sort({ scheduledDate: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Collection.countDocuments({ binId })
      ]);

      ResponseHandler.paginated(res, collections, {
        page: pageNum,
        limit: limitNum,
        total
      });

    } catch (error) {
      logger.error('Get collection history error:', error);
      ResponseHandler.error(res, 'Failed to get collection history');
    }
  }

  static async startCollection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const collection = await Collection.findById(id);
      if (!collection) {
        ResponseHandler.error(res, 'Collection not found', 404);
        return;
      }

      if (collection.status !== 'scheduled') {
        ResponseHandler.error(res, 'Only scheduled collections can be started', 400);
        return;
      }

      collection.status = 'in_progress';
      await collection.save();

      logger.info(`Collection started: ${collection.collectionId}`, {
        collectionId: collection._id
      });

      // Emit real-time update
      SocketService.emitCollectionUpdate(collection);

      ResponseHandler.success(res, collection, 'Collection started successfully');

    } catch (error) {
      logger.error('Start collection error:', error);
      ResponseHandler.error(res, 'Failed to start collection');
    }
  }
}

