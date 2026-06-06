import { Request, Response } from 'express';
import { ResponseHandler } from '@/utils/response';
import { logger } from '@/utils/logger';
import { Route } from '@/models/Route';
import { Bin } from '@/models/Bin';
import { SocketService } from '@/services/socketService';
import mongoose from 'mongoose';

export class RouteController {
  static async getRoutes(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        priority,
        collectorId,
        startDate,
        endDate
      } = req.query;

      // Build filter object
      const filter: any = {};
      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (collectorId) {
        // Route schema defines collectorId as String, but it's actually stored as ObjectId in DB
        // Convert string to ObjectId for proper matching
        const collectorIdStr = collectorId as string;
        if (mongoose.Types.ObjectId.isValid(collectorIdStr)) {
          // Use ObjectId since that's how it's stored in the database
          filter.collectorId = new mongoose.Types.ObjectId(collectorIdStr);
          logger.info('Filtering routes by collectorId (converted to ObjectId)', {
            collectorIdString: collectorIdStr,
            collectorIdObjectId: filter.collectorId.toString()
          });
        } else {
          // Fallback to string if invalid ObjectId format
          filter.collectorId = collectorIdStr;
          logger.warn('Invalid ObjectId format for collectorId, using as string', { collectorId: collectorIdStr });
        }
      }

      // No default status filter — return all routes unless a specific status is requested

      logger.info('Route filter', { filter, query: req.query });

      if (startDate || endDate) {
        filter.scheduledDate = {};
        if (startDate) filter.scheduledDate.$gte = new Date(startDate as string);
        if (endDate) filter.scheduledDate.$lte = new Date(endDate as string);
      }

      // Calculate pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Get routes with pagination
      logger.info('Executing route query', {
        filter: JSON.stringify(filter),
        skip,
        limit: limitNum
      });

      const [routes, total] = await Promise.all([
        Route.find(filter)
          .sort({ scheduledDate: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Route.countDocuments(filter)
      ]);

      const firstRoute = routes.length > 0 ? routes[0] : null;
      logger.info('Routes query result', {
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

      // Additional debug: test query directly if no routes found
      if (collectorId && routes.length === 0) {
        const testQuery = await Route.find({
          collectorId: new mongoose.Types.ObjectId(collectorId as string)
        }).lean();

        logger.warn('Direct query test (no status filter)', {
          collectorId,
          found: testQuery.length,
          routes: testQuery.map(r => ({ id: r._id.toString(), name: r.name, status: r.status }))
        });
      }

      ResponseHandler.paginated(res, routes, {
        page: pageNum,
        limit: limitNum,
        total
      });

    } catch (error) {
      logger.error('Get routes error:', error);
      ResponseHandler.error(res, 'Failed to get routes');
    }
  }

  static async getRouteById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, 'Invalid route ID format', 400);
        return;
      }

      const route = await Route.findById(id).lean();
      if (!route) {
        ResponseHandler.error(res, 'Route not found', 404);
        return;
      }

      // Populate bins with full bin data including location
      if (route.bins && Array.isArray(route.bins) && route.bins.length > 0) {
        const bins = await Bin.find({ _id: { $in: route.bins } }).lean();
        // Replace bins array with populated bin data
        (route as any).bins = bins.map(bin => ({
          ...bin,
          binId: bin.binId || bin._id,
          collected: false, // Default to false, can be updated from binsVisited
        }));

        // Mark bins as collected if they're in binsVisited
        if (route.binsVisited && Array.isArray(route.binsVisited)) {
          const visitedBinIds = route.binsVisited.map((v: any) =>
            v.binId?.toString() || v.binId
          );
          (route as any).bins = (route as any).bins.map((bin: any) => ({
            ...bin,
            collected: visitedBinIds.includes(bin._id?.toString() || bin._id),
          }));
        }
      }

      logger.info('Route details retrieved', {
        routeId: id,
        binsCount: (route as any).bins?.length || 0,
        status: route.status
      });

      ResponseHandler.success(res, route, 'Route retrieved successfully');

    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === 'CastError') {
        ResponseHandler.error(res, 'Invalid route ID format', 400);
        return;
      }

      logger.error('Get route by ID error:', error);
      ResponseHandler.error(res, 'Failed to get route', 500);
    }
  }

  static async createRoute(req: Request, res: Response): Promise<void> {
    try {
      const routeData = req.body;

      // Validate that bins exist
      if (routeData.bins && routeData.bins.length > 0) {
        const binCount = await Bin.countDocuments({
          _id: { $in: routeData.bins }
        });

        if (binCount !== routeData.bins.length) {
          ResponseHandler.error(res, 'One or more bin IDs are invalid', 400);
          return;
        }
      }

      // Generate unique routeId
      const routeCount = await Route.countDocuments();
      routeData.routeId = `ROUTE${String(routeCount + 1).padStart(5, '0')}`;

      const route = await Route.create(routeData);

      logger.info(`Route created: ${route.routeId}`, {
        routeId: route._id,
        name: route.name
      });

      // Emit real-time update
      SocketService.emitRouteUpdate(route);

      ResponseHandler.success(res, route, 'Route created successfully', 201);

    } catch (error) {
      logger.error('Create route error:', error);
      ResponseHandler.error(res, 'Failed to create route');
    }
  }

  static async updateRoute(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, 'Invalid route ID format', 400);
        return;
      }

      // Validate bins if provided
      if (updateData.bins && updateData.bins.length > 0) {
        const binCount = await Bin.countDocuments({
          _id: { $in: updateData.bins }
        });

        if (binCount !== updateData.bins.length) {
          ResponseHandler.error(res, 'One or more bin IDs are invalid', 400);
          return;
        }
      }

      const route = await Route.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!route) {
        ResponseHandler.error(res, 'Route not found', 404);
        return;
      }

      // Emit real-time update
      SocketService.emitRouteUpdate(route);

      logger.info(`Route updated: ${route.routeId}`, { routeId: route._id });

      ResponseHandler.success(res, route, 'Route updated successfully');

    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === 'CastError') {
        ResponseHandler.error(res, 'Invalid route ID format', 400);
        return;
      }

      logger.error('Update route error:', error);
      ResponseHandler.error(res, 'Failed to update route', 500);
    }
  }

  static async deleteRoute(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, 'Invalid route ID format', 400);
        return;
      }

      const route = await Route.findByIdAndDelete(id);
      if (!route) {
        ResponseHandler.error(res, 'Route not found', 404);
        return;
      }

      logger.info(`Route deleted: ${route.routeId}`, { routeId: route._id });

      // Emit real-time update
      SocketService.emitRouteDeletion(route._id.toString());

      ResponseHandler.success(res, null, 'Route deleted successfully');

    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === 'CastError') {
        ResponseHandler.error(res, 'Invalid route ID format', 400);
        return;
      }

      logger.error('Delete route error:', error);
      ResponseHandler.error(res, 'Failed to delete route', 500);
    }
  }

  static async optimizeRouteDirect(req: Request, res: Response): Promise<void> {
    try {
      const { bins, collector_location, time_windows, traffic_multiplier } = req.body;

      if (!bins || !Array.isArray(bins) || bins.length < 2) {
        ResponseHandler.error(res, 'At least 2 bins are required for optimization', 400);
        return;
      }

      if (!collector_location || !collector_location.latitude || !collector_location.longitude) {
        ResponseHandler.error(res, 'Collector location (latitude, longitude) is required', 400);
        return;
      }

      // Import ML client dynamically to avoid circular dependency
      const { MLClient } = await import('@/services/mlClient');
      const mlClient = new MLClient();

      try {
        // Format bins for ML service
        const mlBins = bins.map((bin: any) => {
          // Normalize location format
          let latitude: number;
          let longitude: number;

          if (bin.location?.coordinates && Array.isArray(bin.location.coordinates)) {
            // GeoJSON format: [longitude, latitude]
            latitude = bin.location.coordinates[1];
            longitude = bin.location.coordinates[0];
          } else if (bin.location?.latitude !== undefined && bin.location?.longitude !== undefined) {
            latitude = bin.location.latitude;
            longitude = bin.location.longitude;
          } else {
            logger.warn(`Invalid location format for bin ${bin.binId || bin._id}`, { bin });
            // Use default location if missing
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

        // Call ML service for route optimization
        const optimization = await mlClient.optimizeRoute(
          mlBins,
          {
            latitude: collector_location.latitude,
            longitude: collector_location.longitude
          },
          {
            time_windows,
            traffic_multiplier: traffic_multiplier || 1.0
          }
        );

        // Transform ML service response to frontend format
        const response = {
          optimizedOrder: optimization.optimized_route,
          totalDistance: optimization.total_distance_km,
          estimatedDuration: Math.round(optimization.estimated_duration_hours * 60), // Convert to minutes
          efficiency: optimization.efficiency_score,
          routeDetails: optimization.route_details
        };

        logger.info('Route optimized directly', {
          binsCount: bins.length,
          distance: optimization.total_distance_km,
          efficiency: optimization.efficiency_score
        });

        ResponseHandler.success(res, response, 'Route optimized successfully');

      } catch (mlError: any) {
        // Fallback: Basic greedy algorithm if ML service fails
        logger.warn('ML service unavailable, using fallback algorithm', {
          error: mlError.message || mlError,
          stack: mlError.stack
        });

        try {
          // Simple nearest-neighbor fallback
          const optimizedOrder = RouteController.nearestNeighborOptimizationDirect(bins, collector_location);

          // Calculate total distance for fallback
          let totalDistance = 0;
          let currentLoc = collector_location;
          for (const bin of optimizedOrder) {
            let binLat: number;
            let binLon: number;
            if (bin.location?.coordinates) {
              binLat = bin.location.coordinates[1];
              binLon = bin.location.coordinates[0];
            } else if (bin.location?.latitude) {
              binLat = bin.location.latitude;
              binLon = bin.location.longitude;
            } else {
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
          // Return to start
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
            optimizedOrder: optimizedOrder.map((b: any) => b.binId || b._id || b.bin_id),
            totalDistance: parseFloat(totalDistance.toFixed(2)),
            estimatedDuration: Math.round((totalDistance / 30) * 60), // Assuming 30 km/h average
            efficiency: 0.85, // Fallback efficiency
            routeDetails: []
          };

          ResponseHandler.success(res, response, 'Route optimized using fallback algorithm (ML service unavailable)');
        } catch (fallbackError: any) {
          logger.error('Fallback optimization also failed', { error: fallbackError });
          ResponseHandler.error(res, `Route optimization failed: ${fallbackError.message || 'Unknown error'}`, 500);
        }
      }

    } catch (error: any) {
      logger.error('Optimize route direct error:', {
        error: error.message,
        stack: error.stack,
        body: req.body,
      });

      // Return more specific error message
      const errorMessage = error.message || 'Failed to optimize route';
      ResponseHandler.error(res, errorMessage, error.statusCode || 500);
    }
  }

  // Helper: Nearest neighbor optimization for direct optimization (fallback)
  private static nearestNeighborOptimizationDirect(bins: any[], startLocation: { latitude: number; longitude: number }): any[] {
    if (bins.length <= 1) return bins;

    const optimized: any[] = [];
    const remaining = [...bins];
    let currentLocation = startLocation;

    while (remaining.length > 0) {
      let nearestBin: any = null;
      let minDistance = Infinity;

      for (const bin of remaining) {
        let binLat: number;
        let binLon: number;

        if (bin.location?.coordinates && Array.isArray(bin.location.coordinates)) {
          binLat = bin.location.coordinates[1];
          binLon = bin.location.coordinates[0];
        } else if (bin.location?.latitude !== undefined && bin.location?.longitude !== undefined) {
          binLat = bin.location.latitude;
          binLon = bin.location.longitude;
        } else {
          continue;
        }

        // Haversine distance
        const R = 6371; // Earth's radius in km
        const dLat = ((binLat - currentLocation.latitude) * Math.PI) / 180;
        const dLon = ((binLon - currentLocation.longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
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
        } else if (nearestBin.location?.latitude) {
          currentLocation = {
            latitude: nearestBin.location.latitude,
            longitude: nearestBin.location.longitude
          };
        }
      } else {
        break;
      }
    }

    return optimized;
  }

  static async optimizeRoute(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { time_windows, traffic_multiplier } = req.body || {};

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, 'Invalid route ID format', 400);
        return;
      }

      const route = await Route.findById(id);
      if (!route) {
        ResponseHandler.error(res, 'Route not found', 404);
        return;
      }

      // Get bins data for optimization
      const bins = await Bin.find({ _id: { $in: route.bins } }).lean();

      if (bins.length === 0) {
        ResponseHandler.error(res, 'No bins found for this route', 400);
        return;
      }

      // Import ML client dynamically to avoid circular dependency
      const { MLClient } = await import('@/services/mlClient');
      const mlClient = new MLClient();

      try {
        // Call ML service for route optimization
        const optimization = await mlClient.optimizeRoute(
          bins.map(bin => ({
            bin_id: bin.binId,
            latitude: bin.location.latitude,
            longitude: bin.location.longitude,
            bin_type: bin.binType,
            current_level: bin.currentLevel,
            capacity: bin.capacity,
            priority: bin.isOverflowing ? 5 : 1
          })),
          {
            latitude: 6.9271, // Default: Colombo, Sri Lanka
            longitude: 79.8612
          },
          {
            time_windows,
            traffic_multiplier,
          }
        );

        // Update route with optimized data
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

        logger.info(`Route optimized: ${route.routeId}`, {
          distance: optimization.total_distance_km,
          efficiency: optimization.efficiency_score
        });

        // Emit real-time update
        SocketService.emitRouteUpdate(route);

        ResponseHandler.success(res, {
          route,
          optimization
        }, 'Route optimized successfully');

      } catch (mlError) {
        // Fallback: Basic greedy algorithm if ML service fails
        logger.warn('ML service unavailable, using fallback algorithm', { error: mlError });

        // Simple greedy nearest-neighbor algorithm
        const optimizedBins = this.nearestNeighborOptimization(bins);
        route.bins = optimizedBins.map(b => b._id.toString());
        await route.save();

        ResponseHandler.success(res, {
          route,
          message: 'Route optimized using fallback algorithm (ML service unavailable)'
        }, 'Route optimized successfully');
      }

    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === 'CastError') {
        ResponseHandler.error(res, 'Invalid route ID format', 400);
        return;
      }

      logger.error('Optimize route error:', error);
      ResponseHandler.error(res, 'Failed to optimize route', 500);
    }
  }

  static async startRoute(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, 'Invalid route ID format', 400);
        return;
      }

      const route = await Route.findById(id);
      if (!route) {
        ResponseHandler.error(res, 'Route not found', 404);
        return;
      }

      if (route.status !== 'draft') {
        ResponseHandler.error(res, 'Only draft routes can be started', 400);
        return;
      }

      route.status = 'active';
      route.actualStartTime = new Date();
      await route.save();

      logger.info(`Route started: ${route.routeId}`, { routeId: route._id });

      // Emit real-time update
      SocketService.emitRouteUpdate(route);

      ResponseHandler.success(res, route, 'Route started successfully');

    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === 'CastError') {
        ResponseHandler.error(res, 'Invalid route ID format', 400);
        return;
      }

      logger.error('Start route error:', error);
      ResponseHandler.error(res, 'Failed to start route', 500);
    }
  }

  static async completeRoute(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, 'Invalid route ID format', 400);
        return;
      }

      const route = await Route.findById(id);
      if (!route) {
        ResponseHandler.error(res, 'Route not found', 404);
        return;
      }

      if (route.status !== 'active') {
        ResponseHandler.error(res, 'Only active routes can be completed', 400);
        return;
      }

      route.status = 'completed';
      route.actualEndTime = new Date();

      // Calculate actual duration
      if (route.actualStartTime) {
        route.actualDuration = Math.round(
          (route.actualEndTime.getTime() - route.actualStartTime.getTime()) / 60000
        );
      }

      await route.save();

      logger.info(`Route completed: ${route.routeId}`, {
        routeId: route._id,
        duration: route.actualDuration,
        binsVisited: route.binsVisited.length
      });

      // Emit real-time update
      SocketService.emitRouteUpdate(route);

      ResponseHandler.success(res, route, 'Route completed successfully');

    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === 'CastError') {
        ResponseHandler.error(res, 'Invalid route ID format', 400);
        return;
      }

      logger.error('Complete route error:', error);
      ResponseHandler.error(res, 'Failed to complete route', 500);
    }
  }

  static async markBinVisited(req: Request, res: Response): Promise<void> {
    try {
      const { id, binId } = req.params;
      const { photoUrl, notes } = req.body;

      const route = await Route.findById(id);
      if (!route) {
        ResponseHandler.error(res, 'Route not found', 404);
        return;
      }

      if (!binId) {
        ResponseHandler.error(res, 'Bin ID is required', 400);
        return;
      }

      logger.info('Mark bin visited request', {
        routeId: id,
        binId: binId,
        routeBins: route.bins.map((b: any) => b.toString())
      });

      // Handle both ObjectId and binId (string) formats
      let binObjectId: mongoose.Types.ObjectId | null = null;

      // First, try to convert binId to ObjectId if it's a valid ObjectId format
      if (mongoose.Types.ObjectId.isValid(binId)) {
        binObjectId = new mongoose.Types.ObjectId(binId);
        logger.info('Bin ID is valid ObjectId format', { binObjectId: binObjectId.toString() });
      } else {
        // If not a valid ObjectId, try to find the bin by binId field
        logger.info('Bin ID is not ObjectId format, searching by binId field', { binId });
        const bin = await Bin.findOne({ binId: binId }).lean();
        if (bin && (bin as any)._id) {
          const binIdValue = (bin as any)._id;
          binObjectId = binIdValue instanceof mongoose.Types.ObjectId
            ? binIdValue
            : new mongoose.Types.ObjectId(binIdValue.toString());
          logger.info('Found bin by binId field', {
            binId: binId,
            binObjectId: binObjectId.toString(),
            binBinId: (bin as any).binId
          });
        } else {
          logger.warn('Bin not found by binId field', { binId });
        }
      }

      if (!binObjectId) {
        ResponseHandler.error(res, 'Bin not found', 404);
        return;
      }

      // Check if bin is part of the route (route.bins contains ObjectIds)
      const binInRoute = route.bins.some((routeBinId: any) => {
        const routeBinObjectId = routeBinId instanceof mongoose.Types.ObjectId
          ? routeBinId
          : new mongoose.Types.ObjectId(routeBinId.toString());
        return routeBinObjectId.equals(binObjectId!);
      });

      if (!binInRoute) {
        logger.warn('Bin is not part of this route', {
          routeId: id,
          binId: binId,
          binObjectId: binObjectId.toString(),
          routeBins: route.bins.map((b: any) => b.toString())
        });
        ResponseHandler.error(res, 'Bin is not part of this route', 400);
        return;
      }

      // Check if already visited (compare by ObjectId)
      const alreadyVisited = route.binsVisited.find((v: any) => {
        const visitedBinId = v.binId instanceof mongoose.Types.ObjectId
          ? v.binId
          : (mongoose.Types.ObjectId.isValid(v.binId) ? new mongoose.Types.ObjectId(v.binId) : null);
        return visitedBinId && visitedBinId.equals(binObjectId);
      });

      if (alreadyVisited) {
        ResponseHandler.error(res, 'Bin already marked', 400);
        return;
      }

      // Add to visited bins (use ObjectId)
      route.visitBin(binObjectId.toString(), { photoUrl, notes });
      await route.save();

      // Update bin's lastEmptied date
      await Bin.findByIdAndUpdate(binObjectId, {
        lastEmptied: new Date(),
        currentLevel: 0 // Reset fill level after collection
      });

      logger.info(`Bin visited in route ${route.routeId}`, {
        binId: binId,
        binObjectId: binObjectId.toString(),
        routeId: route._id
      });

      // Emit real-time update
      SocketService.emitRouteUpdate(route);

      ResponseHandler.success(res, {
        binId,
        visited: true,
        visitedAt: new Date()
      }, 'Bin marked as visited');

    } catch (error) {
      logger.error('Mark bin visited error:', error);
      ResponseHandler.error(res, 'Failed to mark bin as visited');
    }
  }

  static async markBinSkipped(req: Request, res: Response): Promise<void> {
    try {
      const { id, binId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        ResponseHandler.error(res, 'Skip reason is required', 400);
        return;
      }

      const route = await Route.findById(id);
      if (!route) {
        ResponseHandler.error(res, 'Route not found', 404);
        return;
      }

      if (!binId || !route.bins.includes(binId)) {
        ResponseHandler.error(res, 'Bin is not part of this route', 400);
        return;
      }

      // Check if already marked
      const alreadyMarked = route.binsVisited.find(v => v.binId === binId);
      if (alreadyMarked) {
        ResponseHandler.error(res, 'Bin already marked', 400);
        return;
      }

      // Add to skipped bins
      route.skipBin(binId, reason);
      await route.save();

      logger.info(`Bin skipped in route ${route.routeId}`, {
        binId,
        reason,
        routeId: route._id
      });

      // Emit real-time update
      SocketService.emitRouteUpdate(route);

      ResponseHandler.success(res, {
        binId,
        skipped: true,
        reason
      }, 'Bin marked as skipped');

    } catch (error) {
      logger.error('Mark bin skipped error:', error);
      ResponseHandler.error(res, 'Failed to mark bin as skipped');
    }
  }

  // Helper: Simple nearest-neighbor optimization for fallback
  private static nearestNeighborOptimization(bins: any[]): any[] {
    if (bins.length <= 1) return bins;

    const optimized: any[] = [];
    const remaining = [...bins];

    // Start with bin with highest fill level
    let current = remaining.reduce((max, bin) =>
      (bin.currentLevel > max.currentLevel) ? bin : max
    );

    optimized.push(current);
    remaining.splice(remaining.indexOf(current), 1);

    // Greedy nearest neighbor
    while (remaining.length > 0) {
      let nearest = remaining[0];
      let minDistance = this.calculateDistance(
        current.location.latitude,
        current.location.longitude,
        nearest.location.latitude,
        nearest.location.longitude
      );

      for (const bin of remaining) {
        const distance = this.calculateDistance(
          current.location.latitude,
          current.location.longitude,
          bin.location.latitude,
          bin.location.longitude
        );

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

  // Helper: Calculate distance between two coordinates (Haversine formula)
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}
