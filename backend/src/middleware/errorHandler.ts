import { Request, Response, NextFunction } from "express";
import { logger } from "@/utils/logger";
import { ResponseHandler } from "@/utils/response";

type KnownError = Error & {
  name?: string;
  code?: number;
  status?: number;
  stack?: string;
  errors?: Record<string, { message: string }>;
  keyValue?: Record<string, unknown>;
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode = 500;
  let message = "Internal Server Error";
  const error = (err as KnownError) || ({} as KnownError);

  // Mongoose validation error
  if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
    const errors = Object.values(error.errors ?? {}).map((e) => e.message);
    (error as unknown as { message: string }).message = errors.join(", ");
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    statusCode = 400;
    message = "Duplicate field value";
    const field = Object.keys(error.keyValue ?? { field: "" })[0];
    (error as unknown as { message: string }).message =
      `${field} already exists`;
  }

  // Mongoose cast error
  if (error.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
  }

  // JWT errors
  if (error.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (error.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  // Rate limit error
  if (error.status === 429) {
    statusCode = 429;
    message = "Too many requests";
  }

  // Log error
  const errorMessage = typeof error === 'string'
    ? error
    : (error instanceof Error ? error.message : String(error));

  logger.error("Error occurred:", {
    error: errorMessage,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  // Send error response
  ResponseHandler.error(
    res,
    message,
    statusCode,
    errorMessage,
  );
};
