"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionController = void 0;
const response_1 = require("../utils/response");
const logger_1 = require("../utils/logger");
const Collection_1 = require("../models/Collection");
const Bin_1 = require("../models/Bin");
const User_1 = require("../models/User");
const socketService_1 = require("../services/socketService");
class CollectionController {
    static async getCollections(req, res) {
        try {
            const { page = 1, limit = 10, status, collectorId, binId, wasteType, startDate, endDate } = req.query;
            const filter = {};
            if (status)
                filter.status = status;
            if (collectorId)
                filter.collectorId = collectorId;
            if (binId)
                filter.binId = binId;
            if (wasteType)
                filter.wasteType = wasteType;
            if (startDate || endDate) {
                filter.scheduledDate = {};
                if (startDate)
                    filter.scheduledDate.$gte = new Date(startDate);
                if (endDate)
                    filter.scheduledDate.$lte = new Date(endDate);
            }
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const skip = (pageNum - 1) * limitNum;
            const [collections, total] = await Promise.all([
                Collection_1.Collection.find(filter)
                    .sort({ scheduledDate: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                Collection_1.Collection.countDocuments(filter)
            ]);
            response_1.ResponseHandler.paginated(res, collections, {
                page: pageNum,
                limit: limitNum,
                total
            });
        }
        catch (error) {
            logger_1.logger.error('Get collections error:', error);
            response_1.ResponseHandler.error(res, 'Failed to get collections');
        }
    }
    static async getCollectionById(req, res) {
        try {
            const { id } = req.params;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, 'Invalid collection ID format', 400);
                return;
            }
            const collection = await Collection_1.Collection.findById(id).lean();
            if (!collection) {
                response_1.ResponseHandler.error(res, 'Collection not found', 404);
                return;
            }
            response_1.ResponseHandler.success(res, collection, 'Collection retrieved successfully');
        }
        catch (error) {
            if (error.name === 'CastError') {
                response_1.ResponseHandler.error(res, 'Invalid collection ID format', 400);
                return;
            }
            logger_1.logger.error('Get collection by ID error:', error);
            response_1.ResponseHandler.error(res, 'Failed to get collection', 500);
        }
    }
    static async createCollection(req, res) {
        try {
            const collectionData = req.body;
            if (!collectionData.binId || !collectionData.binId.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, 'Invalid bin ID format', 400);
                return;
            }
            const bin = await Bin_1.Bin.findById(collectionData.binId).lean();
            if (!bin) {
                response_1.ResponseHandler.error(res, 'Bin not found', 404);
                return;
            }
            const collector = await User_1.User.findById(collectionData.collectorId).lean();
            if (!collector) {
                response_1.ResponseHandler.error(res, 'Collector not found', 404);
                return;
            }
            const collectionCount = await Collection_1.Collection.countDocuments();
            collectionData.collectionId = `COL${String(collectionCount + 1).padStart(6, '0')}`;
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
            const collection = await Collection_1.Collection.create(collectionData);
            logger_1.logger.info(`Collection created: ${collection.collectionId}`, {
                collectionId: collection._id,
                binId: bin.binId
            });
            socketService_1.SocketService.emitCollectionUpdate(collection);
            response_1.ResponseHandler.success(res, collection, 'Collection created successfully', 201);
        }
        catch (error) {
            logger_1.logger.error('Create collection error:', error);
            if (error.name === 'ValidationError') {
                const validationErrors = Object.values(error.errors || {}).map((err) => err.message).join(', ');
                response_1.ResponseHandler.error(res, `Validation failed: ${validationErrors}`, 400);
                return;
            }
            if (error.name === 'CastError') {
                response_1.ResponseHandler.error(res, `Invalid ID format: ${error.path || 'unknown'}`, 400);
                return;
            }
            response_1.ResponseHandler.error(res, 'Failed to create collection', 500);
        }
    }
    static async updateCollection(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, 'Invalid collection ID format', 400);
                return;
            }
            const collection = await Collection_1.Collection.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
            if (!collection) {
                response_1.ResponseHandler.error(res, 'Collection not found', 404);
                return;
            }
            socketService_1.SocketService.emitCollectionUpdate(collection);
            logger_1.logger.info(`Collection updated: ${collection.collectionId}`, {
                collectionId: collection._id
            });
            response_1.ResponseHandler.success(res, collection, 'Collection updated successfully');
        }
        catch (error) {
            if (error.name === 'CastError') {
                response_1.ResponseHandler.error(res, 'Invalid collection ID format', 400);
                return;
            }
            logger_1.logger.error('Update collection error:', error);
            response_1.ResponseHandler.error(res, 'Failed to update collection', 500);
        }
    }
    static async deleteCollection(req, res) {
        try {
            const { id } = req.params;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, 'Invalid collection ID format', 400);
                return;
            }
            const collection = await Collection_1.Collection.findByIdAndDelete(id);
            if (!collection) {
                response_1.ResponseHandler.error(res, 'Collection not found', 404);
                return;
            }
            logger_1.logger.info(`Collection deleted: ${collection.collectionId}`, {
                collectionId: collection._id
            });
            response_1.ResponseHandler.success(res, null, 'Collection deleted successfully');
        }
        catch (error) {
            if (error.name === 'CastError') {
                response_1.ResponseHandler.error(res, 'Invalid collection ID format', 400);
                return;
            }
            logger_1.logger.error('Delete collection error:', error);
            response_1.ResponseHandler.error(res, 'Failed to delete collection', 500);
        }
    }
    static async completeCollection(req, res) {
        try {
            const { id } = req.params;
            const { weight, volume, notes, images } = req.body;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, 'Invalid collection ID format', 400);
                return;
            }
            const collection = await Collection_1.Collection.findById(id);
            if (!collection) {
                response_1.ResponseHandler.error(res, 'Collection not found', 404);
                return;
            }
            if (collection.status === 'completed') {
                response_1.ResponseHandler.error(res, 'Collection already completed', 400);
                return;
            }
            collection.status = 'completed';
            collection.actualDate = new Date();
            if (weight)
                collection.weight = weight;
            if (volume)
                collection.volume = volume;
            if (notes)
                collection.notes = notes;
            if (images)
                collection.images = images;
            await collection.save();
            await Bin_1.Bin.findByIdAndUpdate(collection.binId, {
                lastEmptied: new Date(),
                currentLevel: 0,
                nextCollection: null
            });
            logger_1.logger.info(`Collection completed: ${collection.collectionId}`, {
                collectionId: collection._id,
                binId: collection.binId,
                weight,
                volume
            });
            socketService_1.SocketService.emitCollectionUpdate(collection);
            response_1.ResponseHandler.success(res, collection, 'Collection completed successfully');
        }
        catch (error) {
            if (error.name === 'CastError') {
                response_1.ResponseHandler.error(res, 'Invalid collection ID format', 400);
                return;
            }
            logger_1.logger.error('Complete collection error:', error);
            response_1.ResponseHandler.error(res, 'Failed to complete collection', 500);
        }
    }
    static async cancelCollection(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, 'Invalid collection ID format', 400);
                return;
            }
            if (!reason) {
                response_1.ResponseHandler.error(res, 'Cancellation reason is required', 400);
                return;
            }
            const collection = await Collection_1.Collection.findById(id);
            if (!collection) {
                response_1.ResponseHandler.error(res, 'Collection not found', 404);
                return;
            }
            if (collection.status === 'completed') {
                response_1.ResponseHandler.error(res, 'Cannot cancel completed collection', 400);
                return;
            }
            collection.status = 'cancelled';
            collection.notes = reason;
            await collection.save();
            logger_1.logger.info(`Collection cancelled: ${collection.collectionId}`, {
                collectionId: collection._id,
                reason
            });
            socketService_1.SocketService.emitCollectionUpdate(collection);
            response_1.ResponseHandler.success(res, collection, 'Collection cancelled successfully');
        }
        catch (error) {
            if (error.name === 'CastError') {
                response_1.ResponseHandler.error(res, 'Invalid collection ID format', 400);
                return;
            }
            logger_1.logger.error('Cancel collection error:', error);
            response_1.ResponseHandler.error(res, 'Failed to cancel collection', 500);
        }
    }
    static async getCollectionHistory(req, res) {
        try {
            const { binId } = req.params;
            const { page = 1, limit = 10 } = req.query;
            const bin = await Bin_1.Bin.findById(binId);
            if (!bin) {
                response_1.ResponseHandler.error(res, 'Bin not found', 404);
                return;
            }
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const skip = (pageNum - 1) * limitNum;
            const [collections, total] = await Promise.all([
                Collection_1.Collection.find({ binId })
                    .sort({ scheduledDate: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                Collection_1.Collection.countDocuments({ binId })
            ]);
            response_1.ResponseHandler.paginated(res, collections, {
                page: pageNum,
                limit: limitNum,
                total
            });
        }
        catch (error) {
            logger_1.logger.error('Get collection history error:', error);
            response_1.ResponseHandler.error(res, 'Failed to get collection history');
        }
    }
    static async startCollection(req, res) {
        try {
            const { id } = req.params;
            const collection = await Collection_1.Collection.findById(id);
            if (!collection) {
                response_1.ResponseHandler.error(res, 'Collection not found', 404);
                return;
            }
            if (collection.status !== 'scheduled') {
                response_1.ResponseHandler.error(res, 'Only scheduled collections can be started', 400);
                return;
            }
            collection.status = 'in_progress';
            await collection.save();
            logger_1.logger.info(`Collection started: ${collection.collectionId}`, {
                collectionId: collection._id
            });
            socketService_1.SocketService.emitCollectionUpdate(collection);
            response_1.ResponseHandler.success(res, collection, 'Collection started successfully');
        }
        catch (error) {
            logger_1.logger.error('Start collection error:', error);
            response_1.ResponseHandler.error(res, 'Failed to start collection');
        }
    }
}
exports.CollectionController = CollectionController;
//# sourceMappingURL=collectionController.js.map