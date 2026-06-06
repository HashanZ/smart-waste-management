import { Request, Response } from 'express';
import { ResponseHandler } from '@/utils/response';
import { logger } from '@/utils/logger';
import { User } from '@/models/User';

export class AdminController {
  static async mlHealth(_req: Request, res: Response): Promise<void> {
    const start = Date.now();
    try {
      const { MLClient } = await import('@/services/mlClient');
      const mlClient = new MLClient();
      const healthy = await mlClient.healthCheck();
      const latencyMs = Date.now() - start;

      // Check if model files exist
      const fs = require('fs');
      const path = require('path');

      // Try multiple possible paths for model files
      const possiblePaths = [
        path.join(process.cwd(), '..', 'ml-service', 'models', 'waste_prediction_model.pkl'),
        path.join(process.cwd(), 'ml-service', 'models', 'waste_prediction_model.pkl'),
        path.join(__dirname, '..', '..', '..', 'ml-service', 'models', 'waste_prediction_model.pkl'),
      ];

      let modelPath: string | null = null;
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          modelPath = possiblePath;
          break;
        }
      }

      const scalerPath = modelPath ? modelPath.replace('waste_prediction_model.pkl', 'scaler.pkl') : null;
      const modelTrained = modelPath !== null && scalerPath !== null && fs.existsSync(scalerPath);

      logger.info('ML health checked', { healthy, latencyMs, modelTrained });

      if (!healthy) {
        ResponseHandler.error(res, 'ML service unhealthy', 503);
        return;
      }

      ResponseHandler.success(res, {
        healthy: true,
        latencyMs,
        model_trained: modelTrained,
        model_path: modelTrained ? 'models/waste_prediction_model.pkl' : null
      }, 'ML service healthy');
    } catch (error) {
      const latencyMs = Date.now() - start;
      logger.error('ML health check error', { error, latencyMs });
      ResponseHandler.error(res, 'Failed to check ML service health', 500);
    }
  }
  static async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 10, role, isActive } = req.query;

      // Build filter
      const filter: any = {};
      if (role) filter.role = role;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      // Calculate pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Get users with pagination
      const [users, total] = await Promise.all([
        User.find(filter)
          .select('-password')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        User.countDocuments(filter)
      ]);

      ResponseHandler.paginated(res, users, {
        page: pageNum,
        limit: limitNum,
        total
      });

    } catch (error) {
      logger.error('Get users error:', error);
      ResponseHandler.error(res, 'Failed to get users', 500);
    }
  }

  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, 'Invalid user ID format', 400);
        return;
      }

      const user = await User.findById(id).select('-password').lean();
      if (!user) {
        ResponseHandler.error(res, 'User not found', 404);
        return;
      }

      ResponseHandler.success(res, user, 'User retrieved successfully');

    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === 'CastError') {
        ResponseHandler.error(res, 'Invalid user ID format', 400);
        return;
      }

      logger.error('Get user by ID error:', error);
      ResponseHandler.error(res, 'Failed to get user', 500);
    }
  }

  static async createUser(req: Request, res: Response): Promise<void> {
    try {
      const userData = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        ResponseHandler.error(res, 'User with this email already exists', 409);
        return;
      }

      const user = await User.create(userData);
      const userObj = user.toObject();
      const { password, ...userWithoutPassword } = userObj as any;

      logger.info(`User created: ${user.email}`, { userId: user._id });

      ResponseHandler.success(res, userWithoutPassword, 'User created successfully', 201);

    } catch (error: any) {
      logger.error('Create user error:', error);

      // Handle validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors || {}).map((err: any) => err.message).join(', ');
        ResponseHandler.error(res, `Validation failed: ${validationErrors}`, 400);
        return;
      }

      ResponseHandler.error(res, 'Failed to create user', 500);
    }
  }

  static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, 'Invalid user ID format', 400);
        return;
      }

      // Don't allow password updates through this endpoint
      delete updateData.password;

      const user = await User.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        ResponseHandler.error(res, 'User not found', 404);
        return;
      }

      logger.info(`User updated: ${user.email}`, { userId: user._id });

      ResponseHandler.success(res, user, 'User updated successfully');

    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === 'CastError') {
        ResponseHandler.error(res, 'Invalid user ID format', 400);
        return;
      }

      logger.error('Update user error:', error);
      ResponseHandler.error(res, 'Failed to update user', 500);
    }
  }

  static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate MongoDB ObjectId format
      if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        ResponseHandler.error(res, 'Invalid user ID format', 400);
        return;
      }

      const user = await User.findByIdAndDelete(id);
      if (!user) {
        ResponseHandler.error(res, 'User not found', 404);
        return;
      }

      logger.info(`User deleted: ${user.email}`, { userId: user._id });

      ResponseHandler.success(res, null, 'User deleted successfully');

    } catch (error: any) {
      // Handle CastError (invalid ObjectId format)
      if (error.name === 'CastError') {
        ResponseHandler.error(res, 'Invalid user ID format', 400);
        return;
      }

      logger.error('Delete user error:', error);
      ResponseHandler.error(res, 'Failed to delete user', 500);
    }
  }

  static async getSystemStatus(_req: Request, res: Response): Promise<void> {
    try {
      // Mock system status
      const systemStatus = {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        database: 'connected',
        redis: 'connected',
        mqtt: 'connected',
        lastHealthCheck: new Date()
      };

      ResponseHandler.success(res, systemStatus, 'System status retrieved successfully');

    } catch (error) {
      logger.error('Get system status error:', error);
      ResponseHandler.error(res, 'Failed to get system status');
    }
  }

  static async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 50 } = req.query;

      // Mock logs data
      const logs = [
        {
          timestamp: new Date(),
          level: 'info',
          message: 'System started',
          service: 'smart-waste-backend'
        }
      ];

      ResponseHandler.paginated(res, logs, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: 1
      });

    } catch (error) {
      logger.error('Get logs error:', error);
      ResponseHandler.error(res, 'Failed to get logs');
    }
  }

  static async scheduleMaintenance(req: Request, res: Response): Promise<void> {
    try {
      const { type, scheduledTime, description } = req.body;

      // Mock maintenance scheduling
      const maintenance = {
        id: 'maintenance-id',
        type,
        scheduledTime,
        description,
        status: 'scheduled',
        createdAt: new Date()
      };

      logger.info(`Maintenance scheduled: ${type}`);

      ResponseHandler.success(res, maintenance, 'Maintenance scheduled successfully');

    } catch (error) {
      logger.error('Schedule maintenance error:', error);
      ResponseHandler.error(res, 'Failed to schedule maintenance');
    }
  }
}
