"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const response_1 = require("../utils/response");
const errorHandler = (err, req, res, _next) => {
    let statusCode = 500;
    let message = "Internal Server Error";
    const error = err || {};
    if (error.name === "ValidationError") {
        statusCode = 400;
        message = "Validation Error";
        const errors = Object.values(error.errors ?? {}).map((e) => e.message);
        error.message = errors.join(", ");
    }
    if (error.code === 11000) {
        statusCode = 400;
        message = "Duplicate field value";
        const field = Object.keys(error.keyValue ?? { field: "" })[0];
        error.message =
            `${field} already exists`;
    }
    if (error.name === "CastError") {
        statusCode = 400;
        message = "Invalid ID format";
    }
    if (error.name === "JsonWebTokenError") {
        statusCode = 401;
        message = "Invalid token";
    }
    if (error.name === "TokenExpiredError") {
        statusCode = 401;
        message = "Token expired";
    }
    if (error.status === 429) {
        statusCode = 429;
        message = "Too many requests";
    }
    const errorMessage = typeof error === 'string'
        ? error
        : (error instanceof Error ? error.message : String(error));
    logger_1.logger.error("Error occurred:", {
        error: errorMessage,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
    });
    response_1.ResponseHandler.error(res, message, statusCode, errorMessage);
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map