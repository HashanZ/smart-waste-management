"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const morgan_1 = __importDefault(require("morgan"));
const logger_1 = require("../utils/logger");
morgan_1.default.token("id", (req) => {
    return req.id || "unknown";
});
morgan_1.default.token("response-time", (_req, res) => {
    return res.get("X-Response-Time") || "0";
});
morgan_1.default.token("user-agent", (req) => {
    return req.get("User-Agent") || "unknown";
});
const morganFormat = ':remote-addr - :id ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms';
const morganMiddleware = (0, morgan_1.default)(morganFormat, {
    stream: {
        write: (message) => {
            logger_1.logger.info(message.trim());
        },
    },
});
const requestLogger = (req, res, next) => {
    req.id = Math.random().toString(36).substr(2, 9);
    const start = Date.now();
    const originalEnd = res.end;
    res.end = function (chunk, encoding, cb) {
        const duration = Date.now() - start;
        res.set("X-Response-Time", duration.toString());
        return originalEnd.call(this, chunk, encoding, cb);
    };
    morganMiddleware(req, res, next);
};
exports.requestLogger = requestLogger;
//# sourceMappingURL=requestLogger.js.map