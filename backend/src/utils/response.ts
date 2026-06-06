import { Response } from "express";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class ResponseHandler {
  static success<T>(
    res: Response,
    data?: T,
    message: string = "Success",
    statusCode: number = 200,
  ): Response<ApiResponse<T>> {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static error(
    res: Response,
    message: string = "Internal Server Error",
    statusCode: number = 500,
    error?: string,
  ): Response<ApiResponse> {
    return res.status(statusCode).json({
      success: false,
      message,
      error,
    });
  }

  static validationError(
    res: Response,
    message: string = "Validation Error",
    error?: string,
  ): Response<ApiResponse> {
    return res.status(400).json({
      success: false,
      message,
      error,
    });
  }

  static badRequest(
    res: Response,
    message: string = "Bad Request",
    error?: string,
  ): Response<ApiResponse> {
    return res.status(400).json({
      success: false,
      message,
      error,
    });
  }

  static notFound(
    res: Response,
    message: string = "Resource not found",
  ): Response<ApiResponse> {
    return res.status(404).json({
      success: false,
      message,
    });
  }

  static unauthorized(
    res: Response,
    message: string = "Unauthorized",
  ): Response<ApiResponse> {
    return res.status(401).json({
      success: false,
      message,
    });
  }

  static forbidden(
    res: Response,
    message: string = "Forbidden",
  ): Response<ApiResponse> {
    return res.status(403).json({
      success: false,
      message,
    });
  }

  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
    },
    messageOrMetadata: string | Record<string, any> = "Success",
  ): Response<ApiResponse<T[]>> {
    const pages = Math.ceil(pagination.total / pagination.limit);

    // Check if 4th parameter is metadata object or message string
    const isMetadata =
      typeof messageOrMetadata === "object" && messageOrMetadata !== null;
    const message = isMetadata ? "Success" : (messageOrMetadata as string);
    const metadata = isMetadata ? messageOrMetadata : {};

    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages,
        ...metadata, // Include additional metadata in pagination object
      },
    });
  }
}
