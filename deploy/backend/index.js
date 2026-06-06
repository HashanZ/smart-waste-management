"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("express-async-errors");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const config_1 = require("./config/config");
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const mqtt_1 = require("./config/mqtt");
const logger_1 = require("./utils/logger");
const errorHandler_1 = require("./middleware/errorHandler");
const notFoundHandler_1 = require("./middleware/notFoundHandler");
const requestLogger_1 = require("./middleware/requestLogger");
const auth_1 = __importDefault(require("./routes/auth"));
const bins_1 = __importDefault(require("./routes/bins"));
const collections_1 = __importDefault(require("./routes/collections"));
const routes_1 = __importDefault(require("./routes/routes"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const admin_1 = __importDefault(require("./routes/admin"));
const alerts_1 = __importDefault(require("./routes/alerts"));
const dataCollection_1 = __importDefault(require("./routes/dataCollection"));
const socketService_1 = require("./services/socketService");
const scheduler_1 = require("./services/scheduler");
const dataCollector_1 = require("./services/dataCollector");
class Application {
    constructor() {
        this.app = (0, express_1.default)();
        this.server = (0, http_1.createServer)(this.app);
        this.io = new socket_io_1.Server(this.server, {
            cors: {
                origin: config_1.config.cors.origin,
                methods: ['GET', 'POST']
            }
        });
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeErrorHandling();
        this.initializeServices();
    }
    initializeMiddlewares() {
        this.app.use((0, helmet_1.default)());
        this.app.use((0, cors_1.default)(config_1.config.cors));
        const limiter = (0, express_rate_limit_1.default)({
            windowMs: 15 * 60 * 1000,
            max: config_1.config.nodeEnv === 'production' ? 100 : 1000,
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req) => {
                return req.path === '/health' || req.path.startsWith('/socket.io');
            }
        });
        this.app.use(limiter);
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use((0, compression_1.default)());
        this.app.use((0, morgan_1.default)('combined'));
        this.app.use(requestLogger_1.requestLogger);
    }
    initializeRoutes() {
        this.app.get('/health', (_req, res) => {
            const mongoose = require('mongoose');
            const dbStatus = mongoose.connection.readyState;
            const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
            res.status(200).json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: config_1.config.nodeEnv,
                database: {
                    status: dbStates[dbStatus] || 'unknown',
                    connected: dbStatus === 1
                }
            });
        });
        this.app.use('/api/auth', auth_1.default);
        this.app.use('/api/bins', bins_1.default);
        this.app.use('/api/collections', collections_1.default);
        this.app.use('/api/routes', routes_1.default);
        this.app.use('/api/analytics', analytics_1.default);
        this.app.use('/api/admin', admin_1.default);
        this.app.use('/api/alerts', alerts_1.default);
        this.app.use('/api/data-collection', dataCollection_1.default);
        this.app.use('/socket.io', (_req, _res, next) => {
            next();
        });
    }
    initializeErrorHandling() {
        this.app.use(notFoundHandler_1.notFoundHandler);
        this.app.use(errorHandler_1.errorHandler);
    }
    initializeServices() {
        socketService_1.SocketService.initialize(this.io);
        dataCollector_1.DataCollector.start();
        scheduler_1.SchedulerService.start();
    }
    async start() {
        try {
            try {
                await (0, database_1.connectDatabase)();
                logger_1.logger.info('✅ Database connection established');
            }
            catch (error) {
                logger_1.logger.error('❌ Database connection failed:', error.message);
                logger_1.logger.warn('⚠️  Server will start but routes/collections will not work without database');
            }
            try {
                await (0, mqtt_1.connectMQTT)();
            }
            catch (error) {
                logger_1.logger.warn('MQTT connection failed, continuing without MQTT:', error);
            }
            try {
                await (0, redis_1.connectRedis)();
            }
            catch (error) {
                logger_1.logger.warn('Redis connection failed, continuing without cache:', error);
            }
            this.server.listen(config_1.config.port, () => {
                console.log(`🚀 Server running on port ${config_1.config.port}`);
                console.log(`📊 Environment: ${config_1.config.nodeEnv}`);
                console.log(`🔗 Health check: http://localhost:${config_1.config.port}/health`);
            });
            process.on('SIGTERM', this.shutdown.bind(this));
            process.on('SIGINT', this.shutdown.bind(this));
        }
        catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }
    async shutdown() {
        console.log('🛑 Shutting down server...');
        this.server.close(() => {
            console.log('✅ Server closed');
            process.exit(0);
        });
        setTimeout(() => {
            console.error('❌ Forced shutdown');
            process.exit(1);
        }, 10000);
    }
}
const app = new Application();
app.start().catch(console.error);
exports.default = app;
//# sourceMappingURL=index.js.map