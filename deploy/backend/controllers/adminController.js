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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const response_1 = require("../utils/response");
const logger_1 = require("../utils/logger");
const User_1 = require("../models/User");
class AdminController {
    static async mlHealth(_req, res) {
        const start = Date.now();
        try {
            const { MLClient } = await Promise.resolve().then(() => __importStar(require('../services/mlClient')));
            const mlClient = new MLClient();
            const healthy = await mlClient.healthCheck();
            const latencyMs = Date.now() - start;
            const fs = require('fs');
            const path = require('path');
            const possiblePaths = [
                path.join(process.cwd(), '..', 'ml-service', 'models', 'waste_prediction_model.pkl'),
                path.join(process.cwd(), 'ml-service', 'models', 'waste_prediction_model.pkl'),
                path.join(__dirname, '..', '..', '..', 'ml-service', 'models', 'waste_prediction_model.pkl'),
            ];
            let modelPath = null;
            for (const possiblePath of possiblePaths) {
                if (fs.existsSync(possiblePath)) {
                    modelPath = possiblePath;
                    break;
                }
            }
            const scalerPath = modelPath ? modelPath.replace('waste_prediction_model.pkl', 'scaler.pkl') : null;
            const modelTrained = modelPath !== null && scalerPath !== null && fs.existsSync(scalerPath);
            logger_1.logger.info('ML health checked', { healthy, latencyMs, modelTrained });
            if (!healthy) {
                response_1.ResponseHandler.error(res, 'ML service unhealthy', 503);
                return;
            }
            response_1.ResponseHandler.success(res, {
                healthy: true,
                latencyMs,
                model_trained: modelTrained,
                model_path: modelTrained ? 'models/waste_prediction_model.pkl' : null
            }, 'ML service healthy');
        }
        catch (error) {
            const latencyMs = Date.now() - start;
            logger_1.logger.error('ML health check error', { error, latencyMs });
            response_1.ResponseHandler.error(res, 'Failed to check ML service health', 500);
        }
    }
    static async getUsers(req, res) {
        try {
            const { page = 1, limit = 10, role, isActive } = req.query;
            const filter = {};
            if (role)
                filter.role = role;
            if (isActive !== undefined)
                filter.isActive = isActive === 'true';
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const skip = (pageNum - 1) * limitNum;
            const [users, total] = await Promise.all([
                User_1.User.find(filter)
                    .select('-password')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                User_1.User.countDocuments(filter)
            ]);
            response_1.ResponseHandler.paginated(res, users, {
                page: pageNum,
                limit: limitNum,
                total
            });
        }
        catch (error) {
            logger_1.logger.error('Get users error:', error);
            response_1.ResponseHandler.error(res, 'Failed to get users', 500);
        }
    }
    static async getUserById(req, res) {
        try {
            const { id } = req.params;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, 'Invalid user ID format', 400);
                return;
            }
            const user = await User_1.User.findById(id).select('-password').lean();
            if (!user) {
                response_1.ResponseHandler.error(res, 'User not found', 404);
                return;
            }
            response_1.ResponseHandler.success(res, user, 'User retrieved successfully');
        }
        catch (error) {
            if (error.name === 'CastError') {
                response_1.ResponseHandler.error(res, 'Invalid user ID format', 400);
                return;
            }
            logger_1.logger.error('Get user by ID error:', error);
            response_1.ResponseHandler.error(res, 'Failed to get user', 500);
        }
    }
    static async createUser(req, res) {
        try {
            const userData = req.body;
            const existingUser = await User_1.User.findOne({ email: userData.email });
            if (existingUser) {
                response_1.ResponseHandler.error(res, 'User with this email already exists', 409);
                return;
            }
            const user = await User_1.User.create(userData);
            const userObj = user.toObject();
            const { password, ...userWithoutPassword } = userObj;
            logger_1.logger.info(`User created: ${user.email}`, { userId: user._id });
            response_1.ResponseHandler.success(res, userWithoutPassword, 'User created successfully', 201);
        }
        catch (error) {
            logger_1.logger.error('Create user error:', error);
            if (error.name === 'ValidationError') {
                const validationErrors = Object.values(error.errors || {}).map((err) => err.message).join(', ');
                response_1.ResponseHandler.error(res, `Validation failed: ${validationErrors}`, 400);
                return;
            }
            response_1.ResponseHandler.error(res, 'Failed to create user', 500);
        }
    }
    static async updateUser(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, 'Invalid user ID format', 400);
                return;
            }
            delete updateData.password;
            const user = await User_1.User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).select('-password');
            if (!user) {
                response_1.ResponseHandler.error(res, 'User not found', 404);
                return;
            }
            logger_1.logger.info(`User updated: ${user.email}`, { userId: user._id });
            response_1.ResponseHandler.success(res, user, 'User updated successfully');
        }
        catch (error) {
            if (error.name === 'CastError') {
                response_1.ResponseHandler.error(res, 'Invalid user ID format', 400);
                return;
            }
            logger_1.logger.error('Update user error:', error);
            response_1.ResponseHandler.error(res, 'Failed to update user', 500);
        }
    }
    static async deleteUser(req, res) {
        try {
            const { id } = req.params;
            if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
                response_1.ResponseHandler.error(res, 'Invalid user ID format', 400);
                return;
            }
            const user = await User_1.User.findByIdAndDelete(id);
            if (!user) {
                response_1.ResponseHandler.error(res, 'User not found', 404);
                return;
            }
            logger_1.logger.info(`User deleted: ${user.email}`, { userId: user._id });
            response_1.ResponseHandler.success(res, null, 'User deleted successfully');
        }
        catch (error) {
            if (error.name === 'CastError') {
                response_1.ResponseHandler.error(res, 'Invalid user ID format', 400);
                return;
            }
            logger_1.logger.error('Delete user error:', error);
            response_1.ResponseHandler.error(res, 'Failed to delete user', 500);
        }
    }
    static async getSystemStatus(_req, res) {
        try {
            const systemStatus = {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage(),
                database: 'connected',
                redis: 'connected',
                mqtt: 'connected',
                lastHealthCheck: new Date()
            };
            response_1.ResponseHandler.success(res, systemStatus, 'System status retrieved successfully');
        }
        catch (error) {
            logger_1.logger.error('Get system status error:', error);
            response_1.ResponseHandler.error(res, 'Failed to get system status');
        }
    }
    static async getLogs(req, res) {
        try {
            const { page = 1, limit = 50 } = req.query;
            const logs = [
                {
                    timestamp: new Date(),
                    level: 'info',
                    message: 'System started',
                    service: 'smart-waste-backend'
                }
            ];
            response_1.ResponseHandler.paginated(res, logs, {
                page: parseInt(page),
                limit: parseInt(limit),
                total: 1
            });
        }
        catch (error) {
            logger_1.logger.error('Get logs error:', error);
            response_1.ResponseHandler.error(res, 'Failed to get logs');
        }
    }
    static async scheduleMaintenance(req, res) {
        try {
            const { type, scheduledTime, description } = req.body;
            const maintenance = {
                id: 'maintenance-id',
                type,
                scheduledTime,
                description,
                status: 'scheduled',
                createdAt: new Date()
            };
            logger_1.logger.info(`Maintenance scheduled: ${type}`);
            response_1.ResponseHandler.success(res, maintenance, 'Maintenance scheduled successfully');
        }
        catch (error) {
            logger_1.logger.error('Schedule maintenance error:', error);
            response_1.ResponseHandler.error(res, 'Failed to schedule maintenance');
        }
    }
}
exports.AdminController = AdminController;
//# sourceMappingURL=adminController.js.map