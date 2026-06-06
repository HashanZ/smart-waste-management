"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config/config");
const response_1 = require("../utils/response");
const logger_1 = require("../utils/logger");
const User_1 = require("../models/User");
class AuthController {
    static async register(req, res) {
        try {
            const { email, password, firstName, lastName, role } = req.body;
            const existing = await User_1.User.findOne({ email });
            if (existing) {
                response_1.ResponseHandler.error(res, "Email already in use", 409);
                return;
            }
            const created = await User_1.User.create({
                email,
                password,
                firstName,
                lastName,
                role,
                isActive: true,
            });
            const token = jsonwebtoken_1.default.sign({
                id: created._id,
                email: created.email,
                role: created.role,
                firstName: created.firstName,
                lastName: created.lastName,
            }, config_1.config.jwt.secret, { expiresIn: config_1.config.jwt.expiresIn });
            logger_1.logger.info(`New user registered: ${email}`, {
                role,
                userId: created._id,
            });
            response_1.ResponseHandler.success(res, {
                user: created,
                token,
            }, "User registered successfully", 201);
        }
        catch (error) {
            logger_1.logger.error("Registration error:", error);
            response_1.ResponseHandler.error(res, "Registration failed");
        }
    }
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            const user = await User_1.User.findOne({ email, isActive: true });
            if (!user) {
                response_1.ResponseHandler.unauthorized(res, "Invalid email or password");
                return;
            }
            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                response_1.ResponseHandler.unauthorized(res, "Invalid email or password");
                return;
            }
            user.lastLogin = new Date();
            await user.save();
            const token = jsonwebtoken_1.default.sign({
                id: user._id,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
            }, config_1.config.jwt.secret, { expiresIn: config_1.config.jwt.expiresIn });
            logger_1.logger.info(`User logged in: ${email}`, { userId: user._id });
            const userObj = user.toJSON ? user.toJSON() : user;
            response_1.ResponseHandler.success(res, {
                user: userObj,
                token,
            }, "Login successful");
        }
        catch (error) {
            logger_1.logger.error("Login error:", error);
            if (error instanceof Error) {
                logger_1.logger.error(`Login error message: ${error.message}`);
                logger_1.logger.error(`Login error stack: ${error.stack}`);
            }
            else {
                logger_1.logger.error(`Login error: ${JSON.stringify(error)}`);
            }
            response_1.ResponseHandler.error(res, "Login failed");
        }
    }
    static async logout(req, res) {
        try {
            logger_1.logger.info(`User logged out: ${req.user?.email}`, {
                userId: req.user?._id,
            });
            response_1.ResponseHandler.success(res, null, "Logout successful");
        }
        catch (error) {
            logger_1.logger.error("Logout error:", error);
            response_1.ResponseHandler.error(res, "Logout failed");
        }
    }
    static async getProfile(req, res) {
        try {
            const user = req.user;
            response_1.ResponseHandler.success(res, user, "Profile retrieved successfully");
        }
        catch (error) {
            logger_1.logger.error("Get profile error:", error);
            response_1.ResponseHandler.error(res, "Failed to get profile");
        }
    }
    static async updateProfile(req, res) {
        try {
            const { firstName, lastName, phone } = req.body;
            const user = req.user;
            if (!user) {
                response_1.ResponseHandler.error(res, "User not authenticated", 401);
                return;
            }
            const userDoc = await User_1.User.findById(user._id);
            if (!userDoc) {
                response_1.ResponseHandler.error(res, "User not found", 404);
                return;
            }
            if (firstName !== undefined)
                userDoc.firstName = firstName;
            if (lastName !== undefined)
                userDoc.lastName = lastName;
            if (phone !== undefined)
                userDoc.phoneNumber = phone;
            await userDoc.save();
            logger_1.logger.info(`Profile updated: ${userDoc.email}`, { userId: userDoc._id });
            response_1.ResponseHandler.success(res, userDoc, "Profile updated successfully");
        }
        catch (error) {
            logger_1.logger.error("Update profile error:", error);
            response_1.ResponseHandler.error(res, "Failed to update profile");
        }
    }
    static async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const user = req.user;
            if (!user) {
                response_1.ResponseHandler.error(res, "User not authenticated", 401);
                return;
            }
            if (!currentPassword || !newPassword) {
                response_1.ResponseHandler.error(res, "Current password and new password are required", 400);
                return;
            }
            const userDoc = await User_1.User.findById(user._id);
            if (!userDoc) {
                response_1.ResponseHandler.error(res, "User not found", 404);
                return;
            }
            const isCurrentPasswordValid = await userDoc.comparePassword(currentPassword);
            if (!isCurrentPasswordValid) {
                response_1.ResponseHandler.error(res, "Current password is incorrect", 400);
                return;
            }
            const isSamePassword = await userDoc.comparePassword(newPassword);
            if (isSamePassword) {
                response_1.ResponseHandler.error(res, "New password must be different from current password", 400);
                return;
            }
            userDoc.password = newPassword;
            await userDoc.save();
            logger_1.logger.info(`Password changed: ${user.email}`, { userId: user._id });
            response_1.ResponseHandler.success(res, null, "Password changed successfully");
        }
        catch (error) {
            logger_1.logger.error("Change password error:", error);
            response_1.ResponseHandler.error(res, "Failed to change password");
        }
    }
    static async refreshToken(req, res) {
        try {
            const { token } = req.body;
            if (!token) {
                response_1.ResponseHandler.error(res, "Token required", 400);
                return;
            }
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
            const user = { _id: decoded.userId, email: "test@example.com" };
            const newToken = jsonwebtoken_1.default.sign({ userId: user._id }, config_1.config.jwt.secret, {
                expiresIn: config_1.config.jwt.expiresIn,
            });
            response_1.ResponseHandler.success(res, {
                token: newToken,
            }, "Token refreshed successfully");
        }
        catch (error) {
            logger_1.logger.error("Refresh token error:", error);
            response_1.ResponseHandler.unauthorized(res, "Invalid token");
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=authController.js.map