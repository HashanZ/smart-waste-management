"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mlClient = exports.MLClient = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
class MLClient {
    constructor() {
        this.maxRetries = 3;
        this.timeout = 120000;
        const serviceUrl = config_1.config.ml.serviceUrl;
        logger_1.logger.info("Initializing ML Client", { serviceUrl, timeout: this.timeout });
        this.client = axios_1.default.create({
            baseURL: serviceUrl,
            timeout: this.timeout,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config_1.config.jwt.secret}`,
            },
        });
        this.client.interceptors.response.use((response) => response, (error) => this.handleError(error));
    }
    async optimizeRoute(bins, collectorLocation, params) {
        try {
            logger_1.logger.info("Calling ML service for route optimization", {
                binsCount: bins.length,
                location: collectorLocation,
                hasTimeWindows: Boolean(params?.time_windows),
                trafficMultiplier: params?.traffic_multiplier,
            });
            const response = await this.retryRequest(async () => {
                return await this.client.post("/optimize/route", {
                    bins,
                    collector_location: collectorLocation,
                    max_route_duration_hours: 8.0,
                    vehicle_capacity: 1000.0,
                    time_windows: params
                        ? {
                            traffic_multiplier: params.traffic_multiplier,
                            windows: params.time_windows,
                        }
                        : undefined,
                });
            });
            logger_1.logger.info("Route optimization successful", {
                distance: response.data.total_distance_km,
                efficiency: response.data.efficiency_score,
            });
            return response.data;
        }
        catch (error) {
            logger_1.logger.error("Route optimization failed", { error });
            throw new Error("ML service route optimization failed");
        }
    }
    async predictWaste(binId, binType, currentLevel, capacity, location, timeHorizon = 24) {
        try {
            logger_1.logger.info("Calling ML service for waste prediction", {
                binId,
                timeHorizon,
            });
            let normalizedLocation;
            if (location.coordinates && Array.isArray(location.coordinates)) {
                normalizedLocation = {
                    latitude: location.coordinates[1],
                    longitude: location.coordinates[0],
                };
            }
            else if (location.latitude !== undefined && location.longitude !== undefined) {
                normalizedLocation = {
                    latitude: location.latitude,
                    longitude: location.longitude,
                };
            }
            else {
                logger_1.logger.warn(`Missing location for bin ${binId}, using default`);
                normalizedLocation = {
                    latitude: 6.9271,
                    longitude: 79.8612,
                };
            }
            const response = await this.retryRequest(async () => {
                return await this.client.post("/predict/waste", {
                    bin_id: binId,
                    bin_type: binType,
                    current_level: currentLevel,
                    capacity,
                    location: normalizedLocation,
                    time_horizon_hours: timeHorizon,
                    historical_data: [],
                    weather_data: null,
                });
            });
            return response.data;
        }
        catch (error) {
            logger_1.logger.error("Waste prediction failed", { error, binId });
            throw new Error("ML service waste prediction failed");
        }
    }
    async generateSchedule(scheduleData) {
        try {
            const response = await this.retryRequest(async () => {
                return await this.client.post("/schedule/collections", scheduleData);
            });
            return response.data;
        }
        catch (error) {
            logger_1.logger.error("Schedule generation failed", { error });
            throw new Error("ML service schedule generation failed");
        }
    }
    async retryRequest(requestFn, retries = this.maxRetries) {
        try {
            return await requestFn();
        }
        catch (error) {
            if (retries > 0 && this.isRetryableError(error)) {
                logger_1.logger.warn(`Retrying ML service request, attempts remaining: ${retries}`);
                await this.delay(1000 * (this.maxRetries - retries + 1));
                return this.retryRequest(requestFn, retries - 1);
            }
            throw error;
        }
    }
    isRetryableError(error) {
        const err = error;
        if (!err || !err.response) {
            return true;
        }
        const status = err.response.status;
        return status >= 500 || status === 429;
    }
    handleError(error) {
        if (error.response) {
            const errorDetails = {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
                url: error.config?.url,
                method: error.config?.method,
            };
            logger_1.logger.error("ML service error response", errorDetails);
            console.error("🔴 ML Service Error Details:", JSON.stringify(errorDetails, null, 2));
        }
        else if (error.request) {
            const errorDetails = {
                message: "ML service did not respond",
                url: error.config?.url,
                method: error.config?.method,
                code: error.code,
                timeout: error.config?.timeout,
                baseURL: error.config?.baseURL,
            };
            logger_1.logger.error("ML service no response", errorDetails);
            console.error("🔴 ML Service No Response:", JSON.stringify(errorDetails, null, 2));
        }
        else {
            const errorDetails = {
                message: error.message,
                stack: error.stack,
            };
            logger_1.logger.error("ML service request setup error", errorDetails);
            console.error("🔴 ML Service Setup Error:", JSON.stringify(errorDetails, null, 2));
        }
        return Promise.reject(error);
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async healthCheck() {
        try {
            const response = await this.client.get("/health", { timeout: 5000 });
            return response.status === 200;
        }
        catch (error) {
            logger_1.logger.warn("ML service health check failed");
            return false;
        }
    }
    async trainModel(trainingData) {
        try {
            const fullUrl = `${config_1.config.ml.serviceUrl}/train/model`;
            logger_1.logger.info("Training ML model", {
                sampleCount: trainingData.length,
                url: fullUrl,
                baseURL: config_1.config.ml.serviceUrl
            });
            const response = await this.retryRequest(async () => {
                logger_1.logger.info("Sending training request to ML service", { url: fullUrl });
                return await this.client.post("/train/model", trainingData);
            });
            logger_1.logger.info("Model training completed", response.data);
            return response.data;
        }
        catch (error) {
            logger_1.logger.error("Model training failed", { error });
            throw new Error("ML service model training failed");
        }
    }
}
exports.MLClient = MLClient;
exports.mlClient = new MLClient();
//# sourceMappingURL=mlClient.js.map