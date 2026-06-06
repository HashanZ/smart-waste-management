import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "@/config/config";
import { ResponseHandler } from "@/utils/response";
import { logger } from "@/utils/logger";
import { AuthRequest } from "@/middleware/auth";
import { User } from "@/models/User";

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, firstName, lastName, role } = req.body;

      const existing = await User.findOne({ email });
      if (existing) {
        ResponseHandler.error(res, "Email already in use", 409);
        return;
      }

      const created = await User.create({
        email,
        password,
        firstName,
        lastName,
        role,
        isActive: true,
      });

      const token = jwt.sign(
        {
          id: created._id,
          email: created.email,
          role: created.role,
          firstName: created.firstName,
          lastName: created.lastName,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn } as jwt.SignOptions,
      );

      logger.info(`New user registered: ${email}`, {
        role,
        userId: created._id,
      });

      ResponseHandler.success(
        res,
        {
          user: created,
          token,
        },
        "User registered successfully",
        201,
      );
    } catch (error) {
      logger.error("Registration error:", error);
      ResponseHandler.error(res, "Registration failed");
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Check MongoDB connection
      const mongoose = require("mongoose");
      if (mongoose.connection.readyState !== 1) {
        logger.error("Login failed: MongoDB not connected");
        ResponseHandler.error(res, "Database is not available. Please try again later.", 503);
        return;
      }

      const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true });
      if (!user) {
        ResponseHandler.unauthorized(res, "Invalid email or password");
        return;
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        ResponseHandler.unauthorized(res, "Invalid email or password");
        return;
      }

      // Update lastLogin (non-blocking - don't fail login if this fails)
      try {
        user.lastLogin = new Date();
        await user.save();
      } catch (saveErr) {
        logger.warn("Could not update lastLogin:", saveErr);
      }

      const token = jwt.sign(
        {
          id: user._id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn } as jwt.SignOptions,
      );

      logger.info(`User logged in: ${email}`, { userId: user._id });

      // Convert to plain object with `id` for frontend compatibility
      const userObj = user.toJSON ? user.toJSON() : (user as any).toObject?.() || user;
      const safeUser = {
        id: userObj._id || userObj.id,
        email: userObj.email,
        firstName: userObj.firstName,
        lastName: userObj.lastName,
        role: userObj.role,
      };

      ResponseHandler.success(
        res,
        {
          user: safeUser,
          token,
        },
        "Login successful",
      );
    } catch (error) {
      logger.error("Login error:", error);
      if (error instanceof Error) {
        logger.error(`Login error message: ${error.message}`);
        logger.error(`Login error stack: ${error.stack}`);
      } else {
        logger.error(`Login error: ${JSON.stringify(error)}`);
      }
      const isDev = config.nodeEnv === "development";
      const message = error instanceof Error && isDev
        ? `Login failed: ${error.message}`
        : "Login failed";
      ResponseHandler.error(res, message);
    }
  }

  static async logout(req: AuthRequest, res: Response): Promise<void> {
    try {
      logger.info(`User logged out: ${req.user?.email}`, {
        userId: req.user?._id,
      });

      ResponseHandler.success(res, null, "Logout successful");
    } catch (error) {
      logger.error("Logout error:", error);
      ResponseHandler.error(res, "Logout failed");
    }
  }

  static async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user;
      ResponseHandler.success(res, user, "Profile retrieved successfully");
    } catch (error) {
      logger.error("Get profile error:", error);
      ResponseHandler.error(res, "Failed to get profile");
    }
  }

  static async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { firstName, lastName, phone, role } = req.body;
      const user = req.user;

      if (!user) {
        ResponseHandler.error(res, "User not authenticated", 401);
        return;
      }

      // Fetch the full user document from database
      const userDoc = await User.findById(user._id);
      if (!userDoc) {
        ResponseHandler.error(res, "User not found", 404);
        return;
      }

      // Update fields if provided
      if (firstName !== undefined) userDoc.firstName = firstName;
      if (lastName !== undefined) userDoc.lastName = lastName;
      if (phone !== undefined) userDoc.phoneNumber = phone;
      if (role !== undefined) {
        // Validate role is one of the allowed values
        const allowedRoles = ["admin", "collector", "municipal_officer", "supervisor"];
        if (allowedRoles.includes(role)) {
          userDoc.role = role;
        } else {
          ResponseHandler.error(res, "Invalid role specified", 400);
          return;
        }
      }

      // Save changes to database
      await userDoc.save();

      logger.info(`Profile updated: ${userDoc.email}`, { userId: userDoc._id });

      // Return updated user (password will be excluded by toJSON transform)
      ResponseHandler.success(res, userDoc, "Profile updated successfully");
    } catch (error) {
      logger.error("Update profile error:", error);
      ResponseHandler.error(res, "Failed to update profile");
    }
  }

  static async changePassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = req.user;

      if (!user) {
        ResponseHandler.error(res, "User not authenticated", 401);
        return;
      }

      if (!currentPassword || !newPassword) {
        ResponseHandler.error(res, "Current password and new password are required", 400);
        return;
      }

      // Fetch the full user document from database to access password
      const userDoc = await User.findById(user._id);
      if (!userDoc) {
        ResponseHandler.error(res, "User not found", 404);
        return;
      }

      // Verify current password
      const isCurrentPasswordValid = await userDoc.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        ResponseHandler.error(res, "Current password is incorrect", 400);
        return;
      }

      // Check if new password is different from current password
      const isSamePassword = await userDoc.comparePassword(newPassword);
      if (isSamePassword) {
        ResponseHandler.error(res, "New password must be different from current password", 400);
        return;
      }

      // Update password (Mongoose will hash it automatically via pre-save hook)
      userDoc.password = newPassword;
      await userDoc.save();

      logger.info(`Password changed: ${user.email}`, { userId: user._id });

      ResponseHandler.success(res, null, "Password changed successfully");
    } catch (error) {
      logger.error("Change password error:", error);
      ResponseHandler.error(res, "Failed to change password");
    }
  }

  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        ResponseHandler.error(res, "Token required", 400);
        return;
      }

      // Verify the token
      const decoded = jwt.verify(token, config.jwt.secret) as {
        userId: string;
      };
      const user = { _id: decoded.userId, email: "test@example.com" };

      // Generate new token
      const newToken = jwt.sign({ userId: user._id }, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
      } as jwt.SignOptions);

      ResponseHandler.success(
        res,
        {
          token: newToken,
        },
        "Token refreshed successfully",
      );
    } catch (error) {
      logger.error("Refresh token error:", error);
      ResponseHandler.unauthorized(res, "Invalid token");
    }
  }
}
