"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteController = void 0;
const response_1 = require("../utils/response");
const logger_1 = require("../utils/logger");
const Route_1 = require("../models/Route");
const Bin_1 = require("../models/Bin");
const socketService_1 = require("../services/socketService");
const mongoose_1 = __importDefault(require("mongoose"));
class RouteController {
    static async getRoutes(req, res) {
        try {
            const { page = 1, limit = 10, status, priority, collectorId, startDate, endDate } = req.query;
            const filter = {};
            if (status)
                filter.status = status;
            if (priority)
                filter.priority = priority;
            if (collectorId) {
                const collectorIdStr = collectorId;
                if (mongoose_1.default.Types.ObjectId.isValid(collectorIdStr)) {
                    filter.collectorId = new mongoose_1.default.Types.ObjectId(collectorIdStr);
                    logger_1.logger.info('Filtering routes by collectorId (converted to ObjectId)', {
                        collectorIdString: collectorIdStr,
                        collectorIdObjectId: filter.collectorId.toString()
                    });
                }
                else {
                    filter.collectorId = collectorIdStr;
                    logger_1.logger.warn('Invalid ObjectId format for collectorId, using as string', { collectorId: collectorIdStr });
                }
            }
            if (!status) {
                filter.status = { $in: ['active', 'draft'] };
            }
            logger_1.logger.info('Route filter', { filter, query: req.query });
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
            logger_1.logger.info('Executing route query', {
                filter: JSON.stringify(filter),
                skip,
                limit: limitNum
            });
            const [routes, total] = await Promise.all([
                Route_1.Route.find(filter)
                    .sort({ scheduledDate: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                Route_1.Route.countDocuments(filter)
            ]);
            const firstRoute = routes.length > 0 ? routes[0] : null;
            logger_1.logger.info('Routes query result', {
                filter: JSON.stringify(filter),
                routesFound: routes.length,
                total: total,
                firstRoute: firstRoute ? {
                    _id: firstRoute._id,
                    name: firstRoute.name,
                    status: firstRoute.status,
                    collectorId: firstRoute.collectorId,
                    binsCount: Array.isArray(firstRoute.bins) ? firstRoute.bins.length : 0
                } : null,
                allRouteIds: routes.map(r => r._id.toString())
            });
            if (collectorId && routes.length === 0) {
                const testQuery = await Route_1.Route.find({
                    collectorId: new mongoose_1.default.Types.ObjectId(collectorId)
                }).lean();
                logger_1.logger.warn('Direct query test (no status filter)', {
                    collectorId,
                    found: testQuery.length,
                    routes: testQuery.map(r => ({ id: r._id.toString(), name: r.name, status: r.status }))
                });
            }
            response_1.ResponseHandler.paginated(res, routes, {
                page: pageNum,
                limit: limitNum,
                total
            });
        }
        catch (error) {
            logger_1.logger.error('Get routes error:', error);
            response_1.ResponseHandler.error(res, 'Failed to get routes');
        }
    }
    static async getRouteById(req, res) {
        try {
            const { id } = req.params;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, 'Invalid route ID format', 400);
                return;
            }
            const route = await Route_1.Route.findById(id).lean();
            if (!route) {
                response_1.ResponseHandler.error(res, 'Route not found', 404);
                return;
            }
            if (route.bins && Array.isArray(route.bins) && route.bins.length > 0) {
                const bins = await Bin_1.Bin.find({ _id: { $in: route.bins } }).lean();
                route.bins = bins.map(bin => ({
                    ...bin,
                    binId: bin.binId || bin._id,
                    collected: false,
                }));
                if (route.binsVisited && Array.isArray(route.binsVisited)) {
                    const visitedBinIds = route.binsVisited.map((v) => v.binId?.toString() || v.binId);
                    route.bins = route.bins.map((bin) => ({
                        ...bin,
                        collected: visitedBinIds.includes(bin._id?.toString() || bin._id),
                    }));
                }
            }
            logger_1.logger.info('Route details retrieved', {
                routeId: id,
                binsCount: route.bins?.length || 0,
                status: route.status
            });
            response_1.ResponseHandler.success(res, route, 'Route retrieved successfully');
        }
        catch (error) {
            if (error.name === 'CastError') {
                response_1.ResponseHandler.error(res, 'Invalid route ID format', 400);
                return;
            }
            logger_1.logger.error('Get route by ID error:', error);
            response_1.ResponseHandler.error(res, 'Failed to get route', 500);
        }
    }
    static async createRoute(req, res) {
        try {
            const routeData = req.body;
            if (routeData.bins && routeData.bins.length > 0) {
                const binCount = await Bin_1.Bin.countDocuments({
                    _id: { $in: routeData.bins }
                });
                if (binCount !== routeData.bins.length) {
                    response_1.ResponseHandler.error(res, 'One or more bin IDs are invalid', 400);
                    return;
                }
            }
            const routeCount = await Route_1.Route.countDocuments();
            routeData.routeId = `ROUTE${String(routeCount + 1).padStart(5, '0')}`;
            const route = await Route_1.Route.create(routeData);
            logger_1.logger.info(`Route created: ${route.routeId}`, {
                routeId: route._id,
                name: route.name
            });
            socketService_1.SocketService.emitRouteUpdate(route);
            response_1.ResponseHandler.success(res, route, 'Route created successfully', 201);
        }
        catch (error) {
            logger_1.logger.error('Create route error:', error);
            response_1.ResponseHandler.error(res, 'Failed to create route');
        }
    }
    static async updateRoute(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, 'Invalid route ID format', 400);
                return;
            }
            if (updateData.bins && updateData.bins.length > 0) {
                const binCount = await Bin_1.Bin.countDocuments({
                    _id: { $in: updateData.bins }
                });
                if (binCount !== updateData.bins.length) {
                    response_1.ResponseHandler.error(res, 'One or more bin IDs are invalid', 400);
                    return;
                }
            }
            const route = await Route_1.Route.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
            if (!route) {
                response_1.ResponseHandler.error(res, 'Route not found', 404);
                return;
            }
            socketService_1.SocketService.emitRouteUpdate(route);
            logger_1.logger.info(`Route updated: ${route.routeId}`, { routeId: route._id });
            response_1.ResponseHandler.success(res, route, 'Route updated successfully');
        }
        catch (error) {
            if (error.name === 'CastError') {
                response_1.ResponseHandler.error(res, 'Invalid route ID format', 400);
                return;
            }
            logger_1.logger.error('Update route error:', error);
            response_1.ResponseHandler.error(res, 'Failed to update route', 500);
        }
    }
    static async deleteRoute(req, res) {
        try {
            const { id } = req.params;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, 'Invalid route ID format', 400);
                return;
            }
            const route = await Route_1.Route.findByIdAndDelete(id);
            if (!route) {
                response_1.ResponseHandler.error(res, 'Route not found', 404);
                return;
            }
            logger_1.logger.info(`Route deleted: ${route.routeId}`, { routeId: route._id });
            socketService_1.SocketService.emitRouteDeletion(route._id.toString());
            response_1.ResponseHandler.success(res, null, 'Route deleted successfully');
        }
        catch (error) {
            if (error.name === 'CastError') {
                response_1.ResponseHandler.error(res, 'Invalid route ID format', 400);
                return;
            }
            logger_1.logger.error('Delete route error:', error);
            response_1.ResponseHandler.error(res, 'Failed to delete route', 500);
        }
    }
    static async optimizeRouteDirect(req, res) {
        try {
            const { bins, collector_location, time_windows, traffic_multiplier } = req.body;
            if (!bins || !Array.isArray(bins) || bins.length < 2) {
                response_1.ResponseHandler.error(res, 'At least 2 bins are required for optimization', 400);
                return;
            }
            if (!collector_location || !collector_location.latitude || !collector_location.longitude) {
                response_1.ResponseHandler.error(res, 'Collector location (latitude, longitude) is required', 400);
                return;
            }
            const { MLClient } = await Promise.resolve().then(() => __importStar(require('../services/mlClient')));
            const mlClient = new MLClient();
            try {
                const mlBins = bins.map((bin) => {
                    let latitude;
                    let longitude;
                    if (bin.location?.coordinates && Array.isArray(bin.location.coordinates)) {
                        latitude = bin.location.coordinates[1];
                        longitude = bin.location.coordinates[0];
                    }
                    else if (bin.location?.latitude !== undefined && bin.location?.longitude !== undefined) {
                        latitude = bin.location.latitude;
                        longitude = bin.location.longitude;
                    }
                    else {
                        logger_1.logger.warn(`Invalid location format for bin ${bin.binId || bin._id}`, { bin });
                        latitude = 6.9271;
                        longitude = 79.8612;
                    }
                    return {
                        bin_id: bin.binId || bin._id || bin.bin_id,
                        latitude,
                        longitude,
                        bin_type: bin.binType || bin.bin_type || 'general',
                        current_level: bin.currentLevel || bin.fillLevel || bin.current_level || 0,
                        capacity: bin.capacity || 100,
                        priority: bin.priority === 'urgent' ? 5 : bin.priority === 'high' ? 4 : bin.priority === 'medium' ? 3 : 1
                    };
                });
                const optimization = await mlClient.optimizeRoute(mlBins, {
                    latitude: collector_location.latitude,
                    longitude: collector_location.longitude
                }, {
                    time_windows,
                    traffic_multiplier: traffic_multiplier || 1.0
                });
                const response = {
                    optimizedOrder: optimization.optimized_route,
                    totalDistance: optimization.total_distance_km,
                    estimatedDuration: Math.round(optimization.estimated_duration_hours * 60),
                    efficiency: optimization.efficiency_score,
                    routeDetails: optimization.route_details
                };
                logger_1.logger.info('Route optimized directly', {
                    binsCount: bins.length,
                    distance: optimization.total_distance_km,
                    efficiency: optimization.efficiency_score
                });
                response_1.ResponseHandler.success(res, response, 'Route optimized successfully');
            }
            catch (mlError) {
                logger_1.logger.warn('ML service unavailable, using fallback algorithm', {
                    error: mlError.message || mlError,
                    stack: mlError.stack
                });
                try {
                    const optimizedOrder = RouteController.nearestNeighborOptimizationDirect(bins, collector_location);
                    let totalDistance = 0;
                    let currentLoc = collector_location;
                    for (const bin of optimizedOrder) {
                        let binLat;
                        let binLon;
                        if (bin.location?.coordinates) {
                            binLat = bin.location.coordinates[1];
                            binLon = bin.location.coordinates[0];
                        }
                        else if (bin.location?.latitude) {
                            binLat = bin.location.latitude;
                            binLon = bin.location.longitude;
                        }
                        else {
                            continue;
                        }
                        const R = 6371;
                        const dLat = ((binLat - currentLoc.latitude) * Math.PI) / 180;
                        const dLon = ((binLon - currentLoc.longitude) * Math.PI) / 180;
                        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                            Math.cos((currentLoc.latitude * Math.PI) / 180) *
                                Math.cos((binLat * Math.PI) / 180) *
                                Math.sin(dLon / 2) * Math.sin(dLon / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        totalDistance += R * c;
                        currentLoc = { latitude: binLat, longitude: binLon };
                    }
                    const R = 6371;
                    const dLat = ((collector_location.latitude - currentLoc.latitude) * Math.PI) / 180;
                    const dLon = ((collector_location.longitude - currentLoc.longitude) * Math.PI) / 180;
                    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos((currentLoc.latitude * Math.PI) / 180) *
                            Math.cos((collector_location.latitude * Math.PI) / 180) *
                            Math.sin(dLon / 2) * Math.sin(dLon / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    totalDistance += R * c;
                    const response = {
                        optimizedOrder: optimizedOrder.map((b) => b.binId || b._id || b.bin_id),
                        totalDistance: parseFloat(totalDistance.toFixed(2)),
                        estimatedDuration: Math.round((totalDistance / 30) * 60),
                        efficiency: 0.85,
                        routeDetails: []
                    };
                    response_1.ResponseHandler.success(res, response, 'Route optimized using fallback algorithm (ML service unavailable)');
                }
                catch (fallbackError) {
                    logger_1.logger.error('Fallback optimization also failed', { error: fallbackError });
                    response_1.ResponseHandler.error(res, `Route optimization failed: ${fallbackError.message || 'Unknown error'}`, 500);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Optimize route direct error:', {
                error: error.message,
                stack: error.stack,
                body: req.body,
            });
            const errorMessage = error.message || 'Failed to optimize route';
            response_1.ResponseHandler.error(res, errorMessage, error.statusCode || 500);
        }
    }
    static nearestNeighborOptimizationDirect(bins, startLocation) {
        if (bins.length <= 1)
            return bins;
        const optimized = [];
        const remaining = [...bins];
        let currentLocation = startLocation;
        while (remaining.length > 0) {
            let nearestBin = null;
            let minDistance = Infinity;
            for (const bin of remaining) {
                let binLat;
                let binLon;
                if (bin.location?.coordinates && Array.isArray(bin.location.coordinates)) {
                    binLat = bin.location.coordinates[1];
                    binLon = bin.location.coordinates[0];
                }
                else if (bin.location?.latitude !== undefined && bin.location?.longitude !== undefined) {
                    binLat = bin.location.latitude;
                    binLon = bin.location.longitude;
                }
                else {
                    continue;
                }
                const R = 6371;
                const dLat = ((binLat - currentLocation.latitude) * Math.PI) / 180;
                const dLon = ((binLon - currentLocation.longitude) * Math.PI) / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos((currentLocation.latitude * Math.PI) / 180) *
                        Math.cos((binLat * Math.PI) / 180) *
                        Math.sin(dLon / 2) *
                        Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distance = R * c;
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestBin = bin;
                }
            }
            if (nearestBin) {
                optimized.push(nearestBin);
                remaining.splice(remaining.indexOf(nearestBin), 1);
                if (nearestBin.location?.coordinates) {
                    currentLocation = {
                        latitude: nearestBin.location.coordinates[1],
                        longitude: nearestBin.location.coordinates[0]
                    };
                }
                else if (nearestBin.location?.latitude) {
                    currentLocation = {
                        latitude: nearestBin.location.latitude,
                        longitude: nearestBin.location.longitude
                    };
                }
            }
            else {
                break;
            }
        }
        return optimized;
    }
    static async optimizeRoute(req, res) {
        try {
            const { id } = req.params;
            const { time_windows, traffic_multiplier } = req.body || {};
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, 'Invalid route ID format', 400);
                return;
            }
            const route = await Route_1.Route.findById(id);
            if (!route) {
                response_1.ResponseHandler.error(res, 'Route not found', 404);
                return;
            }
            const bins = await Bin_1.Bin.find({ _id: { $in: route.bins } }).lean();
            if (bins.length === 0) {
                response_1.ResponseHandler.error(res, 'No bins found for this route', 400);
                return;
            }
            const { MLClient } = await Promise.resolve().then(() => __importStar(require('../services/mlClient')));
            const mlClient = new MLClient();
            try {
                const optimization = await mlClient.optimizeRoute(bins.map(bin => ({
                    bin_id: bin.binId,
                    latitude: bin.location.latitude,
                    longitude: bin.location.longitude,
                    bin_type: bin.binType,
                    current_level: bin.currentLevel,
                    capacity: bin.capacity,
                    priority: bin.isOverflowing ? 5 : 1
                })), {
                    latitude: 6.9271,
                    longitude: 79.8612
                }, {
                    time_windows,
                    traffic_multiplier,
                });
                route.bins = optimization.optimized_route;
                route.totalDistance = optimization.total_distance_km;
                route.estimatedDuration = Math.round(optimization.estimated_duration_hours * 60);
                route.optimizationData = {
                    efficiency: optimization.efficiency_score,
                    route: optimization.optimized_route,
                    routeDetails: optimization.route_details,
                    parameters: {
                        traffic_multiplier,
                        time_windows,
                    }
                };
                await route.save();
                logger_1.logger.info(`Route optimized: ${route.routeId}`, {
                    distance: optimization.total_distance_km,
                    efficiency: optimization.efficiency_score
                });
                socketService_1.SocketService.emitRouteUpdate(route);
                response_1.ResponseHandler.success(res, {
                    route,
                    optimization
                }, 'Route optimized successfully');
            }
            catch (mlError) {
                logger_1.logger.warn('ML service unavailable, using fallback algorithm', { error: mlError });
                const optimizedBins = this.nearestNeighborOptimization(bins);
                route.bins = optimizedBins.map(b => b._id.toString());
                await route.save();
                response_1.ResponseHandler.success(res, {
                    route,
                    message: 'Route optimized using fallback algorithm (ML service unavailable)'
                }, 'Route optimized successfully');
            }
        }
        catch (error) {
            if (error.name === 'CastError') {
                response_1.ResponseHandler.error(res, 'Invalid route ID format', 400);
                return;
            }
            logger_1.logger.error('Optimize route error:', error);
            response_1.ResponseHandler.error(res, 'Failed to optimize route', 500);
        }
    }
    static async startRoute(req, res) {
        try {
            const { id } = req.params;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, 'Invalid route ID format', 400);
                return;
            }
            const route = await Route_1.Route.findById(id);
            if (!route) {
                response_1.ResponseHandler.error(res, 'Route not found', 404);
                return;
            }
            if (route.status !== 'draft') {
                response_1.ResponseHandler.error(res, 'Only draft routes can be started', 400);
                return;
            }
            route.status = 'active';
            route.actualStartTime = new Date();
            await route.save();
            logger_1.logger.info(`Route started: ${route.routeId}`, { routeId: route._id });
            socketService_1.SocketService.emitRouteUpdate(route);
            response_1.ResponseHandler.success(res, route, 'Route started successfully');
        }
        catch (error) {
            if (error.name === 'CastError') {
                response_1.ResponseHandler.error(res, 'Invalid route ID format', 400);
                return;
            }
            logger_1.logger.error('Start route error:', error);
            response_1.ResponseHandler.error(res, 'Failed to start route', 500);
        }
    }
    static async completeRoute(req, res) {
        try {
            const { id } = req.params;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, 'Invalid route ID format', 400);
                return;
            }
            const route = await Route_1.Route.findById(id);
            if (!route) {
                response_1.ResponseHandler.error(res, 'Route not found', 404);
                return;
            }
            if (route.status !== 'active') {
                response_1.ResponseHandler.error(res, 'Only active routes can be completed', 400);
                return;
            }
            route.status = 'completed';
            route.actualEndTime = new Date();
            if (route.actualStartTime) {
                route.actualDuration = Math.round((route.actualEndTime.getTime() - route.actualStartTime.getTime()) / 60000);
            }
            await route.save();
            logger_1.logger.info(`Route completed: ${route.routeId}`, {
                routeId: route._id,
                duration: route.actualDuration,
                binsVisited: route.binsVisited.length
            });
            socketService_1.SocketService.emitRouteUpdate(route);
            response_1.ResponseHandler.success(res, route, 'Route completed successfully');
        }
        catch (error) {
            if (error.name === 'CastError') {
                response_1.ResponseHandler.error(res, 'Invalid route ID format', 400);
                return;
            }
            logger_1.logger.error('Complete route error:', error);
            response_1.ResponseHandler.error(res, 'Failed to complete route', 500);
        }
    }
    static async markBinVisited(req, res) {
        try {
            const { id, binId } = req.params;
            const { photoUrl, notes } = req.body;
            const route = await Route_1.Route.findById(id);
            if (!route) {
                response_1.ResponseHandler.error(res, 'Route not found', 404);
                return;
            }
            if (!binId) {
                response_1.ResponseHandler.error(res, 'Bin ID is required', 400);
                return;
            }
            logger_1.logger.info('Mark bin visited request', {
                routeId: id,
                binId: binId,
                routeBins: route.bins.map((b) => b.toString())
            });
            let binObjectId = null;
            if (mongoose_1.default.Types.ObjectId.isValid(binId)) {
                binObjectId = new mongoose_1.default.Types.ObjectId(binId);
                logger_1.logger.info('Bin ID is valid ObjectId format', { binObjectId: binObjectId.toString() });
            }
            else {
                logger_1.logger.info('Bin ID is not ObjectId format, searching by binId field', { binId });
                const bin = await Bin_1.Bin.findOne({ binId: binId }).lean();
                if (bin && bin._id) {
                    const binIdValue = bin._id;
                    binObjectId = binIdValue instanceof mongoose_1.default.Types.ObjectId
                        ? binIdValue
                        : new mongoose_1.default.Types.ObjectId(binIdValue.toString());
                    logger_1.logger.info('Found bin by binId field', {
                        binId: binId,
                        binObjectId: binObjectId.toString(),
                        binBinId: bin.binId
                    });
                }
                else {
                    logger_1.logger.warn('Bin not found by binId field', { binId });
                }
            }
            if (!binObjectId) {
                response_1.ResponseHandler.error(res, 'Bin not found', 404);
                return;
            }
            const binInRoute = route.bins.some((routeBinId) => {
                const routeBinObjectId = routeBinId instanceof mongoose_1.default.Types.ObjectId
                    ? routeBinId
                    : new mongoose_1.default.Types.ObjectId(routeBinId.toString());
                return routeBinObjectId.equals(binObjectId);
            });
            if (!binInRoute) {
                logger_1.logger.warn('Bin is not part of this route', {
                    routeId: id,
                    binId: binId,
                    binObjectId: binObjectId.toString(),
                    routeBins: route.bins.map((b) => b.toString())
                });
                response_1.ResponseHandler.error(res, 'Bin is not part of this route', 400);
                return;
            }
            const alreadyVisited = route.binsVisited.find((v) => {
                const visitedBinId = v.binId instanceof mongoose_1.default.Types.ObjectId
                    ? v.binId
                    : (mongoose_1.default.Types.ObjectId.isValid(v.binId) ? new mongoose_1.default.Types.ObjectId(v.binId) : null);
                return visitedBinId && visitedBinId.equals(binObjectId);
            });
            if (alreadyVisited) {
                response_1.ResponseHandler.error(res, 'Bin already marked', 400);
                return;
            }
            route.visitBin(binObjectId.toString(), { photoUrl, notes });
            await route.save();
            await Bin_1.Bin.findByIdAndUpdate(binObjectId, {
                lastEmptied: new Date(),
                currentLevel: 0
            });
            logger_1.logger.info(`Bin visited in route ${route.routeId}`, {
                binId: binId,
                binObjectId: binObjectId.toString(),
                routeId: route._id
            });
            socketService_1.SocketService.emitRouteUpdate(route);
            response_1.ResponseHandler.success(res, {
                binId,
                visited: true,
                visitedAt: new Date()
            }, 'Bin marked as visited');
        }
        catch (error) {
            logger_1.logger.error('Mark bin visited error:', error);
            response_1.ResponseHandler.error(res, 'Failed to mark bin as visited');
        }
    }
    static async markBinSkipped(req, res) {
        try {
            const { id, binId } = req.params;
            const { reason } = req.body;
            if (!reason) {
                response_1.ResponseHandler.error(res, 'Skip reason is required', 400);
                return;
            }
            const route = await Route_1.Route.findById(id);
            if (!route) {
                response_1.ResponseHandler.error(res, 'Route not found', 404);
                return;
            }
            if (!binId || !route.bins.includes(binId)) {
                response_1.ResponseHandler.error(res, 'Bin is not part of this route', 400);
                return;
            }
            const alreadyMarked = route.binsVisited.find(v => v.binId === binId);
            if (alreadyMarked) {
                response_1.ResponseHandler.error(res, 'Bin already marked', 400);
                return;
            }
            route.skipBin(binId, reason);
            await route.save();
            logger_1.logger.info(`Bin skipped in route ${route.routeId}`, {
                binId,
                reason,
                routeId: route._id
            });
            socketService_1.SocketService.emitRouteUpdate(route);
            response_1.ResponseHandler.success(res, {
                binId,
                skipped: true,
                reason
            }, 'Bin marked as skipped');
        }
        catch (error) {
            logger_1.logger.error('Mark bin skipped error:', error);
            response_1.ResponseHandler.error(res, 'Failed to mark bin as skipped');
        }
    }
    static nearestNeighborOptimization(bins) {
        if (bins.length <= 1)
            return bins;
        const optimized = [];
        const remaining = [...bins];
        let current = remaining.reduce((max, bin) => (bin.currentLevel > max.currentLevel) ? bin : max);
        optimized.push(current);
        remaining.splice(remaining.indexOf(current), 1);
        while (remaining.length > 0) {
            let nearest = remaining[0];
            let minDistance = this.calculateDistance(current.location.latitude, current.location.longitude, nearest.location.latitude, nearest.location.longitude);
            for (const bin of remaining) {
                const distance = this.calculateDistance(current.location.latitude, current.location.longitude, bin.location.latitude, bin.location.longitude);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = bin;
                }
            }
            optimized.push(nearest);
            remaining.splice(remaining.indexOf(nearest), 1);
            current = nearest;
        }
        return optimized;
    }
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
exports.RouteController = RouteController;
//# sourceMappingURL=routeController.js.map