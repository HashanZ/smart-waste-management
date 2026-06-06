"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseHandler = void 0;
class ResponseHandler {
    static success(res, data, message = "Success", statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
        });
    }
    static error(res, message = "Internal Server Error", statusCode = 500, error) {
        return res.status(statusCode).json({
            success: false,
            message,
            error,
        });
    }
    static validationError(res, message = "Validation Error", error) {
        return res.status(400).json({
            success: false,
            message,
            error,
        });
    }
    static badRequest(res, message = "Bad Request", error) {
        return res.status(400).json({
            success: false,
            message,
            error,
        });
    }
    static notFound(res, message = "Resource not found") {
        return res.status(404).json({
            success: false,
            message,
        });
    }
    static unauthorized(res, message = "Unauthorized") {
        return res.status(401).json({
            success: false,
            message,
        });
    }
    static forbidden(res, message = "Forbidden") {
        return res.status(403).json({
            success: false,
            message,
        });
    }
    static paginated(res, data, pagination, messageOrMetadata = "Success") {
        const pages = Math.ceil(pagination.total / pagination.limit);
        const isMetadata = typeof messageOrMetadata === "object" && messageOrMetadata !== null;
        const message = isMetadata ? "Success" : messageOrMetadata;
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
                ...metadata,
            },
        });
    }
}
exports.ResponseHandler = ResponseHandler;
//# sourceMappingURL=response.js.map