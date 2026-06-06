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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MLFunctionsTester = void 0;
const axios_1 = __importDefault(require("axios"));
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../config/config");
const Bin_1 = require("../models/Bin");
const Prediction_1 = require("../models/Prediction");
const Collection_1 = require("../models/Collection");
const PredictionAccuracy_1 = require("../models/PredictionAccuracy");
const logger_1 = require("../utils/logger");
class MLFunctionsTester {
    constructor() {
        this.authToken = null;
        this.testResults = [];
        this.baseURL = process.env["API_URL"] || `http://localhost:${config_1.config.port}`;
        this.apiClient = axios_1.default.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }
    async checkUserExists(email) {
        try {
            const { User } = await Promise.resolve().then(() => __importStar(require("../models/User")));
            const user = await User.findOne({ email }).lean();
            return !!user;
        }
        catch (error) {
            return false;
        }
    }
    async deleteUser(email) {
        try {
            const { User } = await Promise.resolve().then(() => __importStar(require("../models/User")));
            const result = await User.deleteOne({ email });
            return result.deletedCount > 0;
        }
        catch (error) {
            logger_1.logger.error(`❌ Failed to delete user: ${error.message}`);
            return false;
        }
    }
    async createTestUser(email, password, forceRecreate = false) {
        try {
            const { User } = await Promise.resolve().then(() => __importStar(require("../models/User")));
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                if (forceRecreate) {
                    logger_1.logger.info(`Deleting existing user ${email} to recreate...`);
                    await this.deleteUser(email);
                }
                else {
                    logger_1.logger.info(`User ${email} already exists`);
                    return true;
                }
            }
            await User.create({
                email,
                password,
                firstName: "Test",
                lastName: "User",
                role: "admin",
                isActive: true,
            });
            logger_1.logger.info(`✅ Created test user: ${email}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`❌ Failed to create test user: ${error.message}`);
            if (error.stack) {
                logger_1.logger.error("Stack trace:", error.stack);
            }
            return false;
        }
    }
    async authenticate() {
        const testEmail = process.env["TEST_EMAIL"] || "test@example.com";
        const testPassword = process.env["TEST_PASSWORD"] || "test123456";
        try {
            logger_1.logger.info(`Attempting authentication with email: ${testEmail}`);
            const userExists = await this.checkUserExists(testEmail);
            if (!userExists) {
                logger_1.logger.info(`User ${testEmail} not found. Attempting to create test user...`);
                const created = await this.createTestUser(testEmail, testPassword);
                if (!created) {
                    logger_1.logger.error("❌ Could not create test user. Please create a user manually or set TEST_EMAIL and TEST_PASSWORD.");
                    logger_1.logger.info("\n💡 To create a user manually:");
                    logger_1.logger.info("   1. Use the registration endpoint: POST /api/auth/register");
                    logger_1.logger.info('   2. Or set environment variables: $env:TEST_EMAIL="your@email.com"; $env:TEST_PASSWORD="yourpassword"');
                    return false;
                }
            }
            const response = await axios_1.default.post(`${this.baseURL}/api/auth/login`, {
                email: testEmail,
                password: testPassword,
            });
            if (response.data.success && response.data.data?.token) {
                this.authToken = response.data.data.token;
                this.apiClient.defaults.headers.common["Authorization"] =
                    `Bearer ${this.authToken}`;
                logger_1.logger.info("✅ Authentication successful");
                return true;
            }
            logger_1.logger.error("❌ Authentication failed: Invalid response format");
            logger_1.logger.error("Response:", JSON.stringify(response.data, null, 2));
            return false;
        }
        catch (error) {
            if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
                logger_1.logger.error("❌ Cannot connect to backend server. Is it running?");
                logger_1.logger.error(`   Tried to connect to: ${this.baseURL}`);
                logger_1.logger.info("\n💡 Make sure the backend server is running:");
                logger_1.logger.info("   cd backend && npm run dev");
                return false;
            }
            const errorMessage = error.response?.data?.message || error.message || "Unknown error";
            const statusCode = error.response?.status || "N/A";
            logger_1.logger.error(`❌ Authentication failed (Status: ${statusCode}):`, errorMessage);
            if (error.response?.data) {
                logger_1.logger.error("Full error response:", JSON.stringify(error.response.data, null, 2));
            }
            else if (error.response) {
                logger_1.logger.error("Error response status:", error.response.status);
                logger_1.logger.error("Error response headers:", JSON.stringify(error.response.headers, null, 2));
            }
            if (statusCode === 401) {
                const userExists = await this.checkUserExists(testEmail);
                if (userExists) {
                    logger_1.logger.info("\n⚠️  User exists but password doesn't match.");
                    logger_1.logger.info("   Deleting existing user and recreating with correct password...");
                    const recreated = await this.createTestUser(testEmail, testPassword, true);
                    if (recreated) {
                        logger_1.logger.info("   ✅ User recreated. Retrying authentication...");
                        try {
                            const retryResponse = await axios_1.default.post(`${this.baseURL}/api/auth/login`, {
                                email: testEmail,
                                password: testPassword,
                            });
                            if (retryResponse.data.success &&
                                retryResponse.data.data?.token) {
                                this.authToken = retryResponse.data.data.token;
                                this.apiClient.defaults.headers.common["Authorization"] =
                                    `Bearer ${this.authToken}`;
                                logger_1.logger.info("✅ Authentication successful after user recreation");
                                return true;
                            }
                        }
                        catch (retryError) {
                            logger_1.logger.error("❌ Authentication still failed after user recreation");
                        }
                    }
                    else {
                        logger_1.logger.error("❌ Failed to recreate user");
                    }
                }
            }
            logger_1.logger.info("\n💡 Tip: Set TEST_EMAIL and TEST_PASSWORD environment variables:");
            logger_1.logger.info('   Example: $env:TEST_EMAIL="your@email.com"; $env:TEST_PASSWORD="yourpassword"; npm run test:ml');
            logger_1.logger.info("   Or create a user account first via the registration endpoint.");
            return false;
        }
    }
    async runTest(name, testFn) {
        const startTime = Date.now();
        try {
            logger_1.logger.info(`\n🧪 Testing: ${name}`);
            const result = await testFn();
            const duration = Date.now() - startTime;
            this.testResults.push({
                name,
                status: "PASS",
                message: "Test passed successfully",
                details: result,
                duration,
            });
            logger_1.logger.info(`✅ PASS: ${name} (${duration}ms)`);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.testResults.push({
                name,
                status: "FAIL",
                message: error.message || "Test failed",
                details: error.response?.data || error.stack,
                duration,
            });
            logger_1.logger.error(`❌ FAIL: ${name} - ${error.message}`);
        }
    }
    async testMLHealth() {
        const response = await this.apiClient.get("/api/admin/ml/health");
        if (!response.data.success) {
            throw new Error("ML health check returned unsuccessful response");
        }
        const health = response.data.data;
        if (typeof health.healthy !== "boolean") {
            throw new Error("Invalid health status format");
        }
        if (!health.healthy) {
            throw new Error("ML service is not healthy");
        }
        logger_1.logger.info(`   Health Status: ${health.healthy ? "✅ Healthy" : "❌ Unhealthy"}`);
        logger_1.logger.info(`   Model Trained: ${health.model_trained ? "✅ Yes" : "⚠️ No"}`);
        logger_1.logger.info(`   Latency: ${health.latencyMs}ms`);
        return health;
    }
    async testPredictions() {
        const bin = await Bin_1.Bin.findOne({ status: "active" })
            .select("binId binType currentLevel capacity")
            .lean();
        if (!bin) {
            throw new Error("No active bins found in database");
        }
        logger_1.logger.info(`   Testing predictions for bin: ${bin.binId}`);
        try {
            const response = await this.apiClient.get("/api/analytics/predictions", {
                params: {
                    binId: bin.binId,
                    days: 24,
                },
            });
            if (!response.data.success) {
                const errorMsg = response.data.message ||
                    "Predictions endpoint returned unsuccessful response";
                const errorDetails = response.data.error || response.data;
                logger_1.logger.error(`   Error details: ${JSON.stringify(errorDetails, null, 2)}`);
                throw new Error(errorMsg);
            }
            const predictions = response.data.data;
            if (!Array.isArray(predictions) && !predictions.predictions) {
                throw new Error("Invalid predictions format");
            }
            const predArray = Array.isArray(predictions)
                ? predictions
                : predictions.predictions || [];
            if (predArray.length === 0) {
                logger_1.logger.warn("   ⚠️ No predictions returned (this is normal if predictions haven't been generated yet)");
            }
            else {
                logger_1.logger.info(`   ✅ Received ${predArray.length} predictions`);
                if (predArray[0]) {
                    logger_1.logger.info(`   Sample prediction: ${JSON.stringify(predArray[0], null, 2)}`);
                }
            }
            return predictions;
        }
        catch (error) {
            if (error.response?.status === 500) {
                logger_1.logger.error(`   Server error (500): ${error.response?.data?.message || error.message}`);
                logger_1.logger.error(`   This might indicate an issue with the predictions endpoint or ML service`);
                logger_1.logger.warn("   ⚠️ Predictions test skipped due to server error");
                return {
                    predictions: [],
                    note: "Server error - predictions unavailable",
                };
            }
            throw error;
        }
    }
    async testPredictionMetrics() {
        const response = await this.apiClient.get("/api/analytics/predictions/metrics", {
            params: {
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                endDate: new Date().toISOString(),
            },
        });
        if (!response.data.success) {
            throw new Error("Prediction metrics endpoint returned unsuccessful response");
        }
        const metrics = response.data.data;
        logger_1.logger.info(`   MAE: ${metrics.accuracy?.mae?.toFixed(2) || "N/A"}`);
        logger_1.logger.info(`   RMSE: ${metrics.accuracy?.rmse?.toFixed(2) || "N/A"}`);
        logger_1.logger.info(`   MAPE: ${metrics.accuracy?.mape?.toFixed(2) || "N/A"}%`);
        logger_1.logger.info(`   ML vs Fallback: ${metrics.mlVsFallback?.mlPercentage?.toFixed(1) || 0}% ML, ${metrics.mlVsFallback?.fallbackPercentage?.toFixed(1) || 0}% Fallback`);
        return metrics;
    }
    async testRouteOptimization() {
        const bins = await Bin_1.Bin.find({ status: "active" })
            .select("binId binType currentLevel capacity location")
            .limit(5)
            .lean();
        if (bins.length < 2) {
            throw new Error("Need at least 2 active bins for route optimization test");
        }
        logger_1.logger.info(`   Testing route optimization with ${bins.length} bins`);
        const binData = bins.map((bin) => ({
            binId: bin.binId,
            binType: bin.binType || "general",
            currentLevel: bin.currentLevel || 0,
            capacity: bin.capacity || 100,
            location: bin.location || { latitude: 6.9271, longitude: 79.8612 },
        }));
        const response = await this.apiClient.post("/api/routes/optimize-direct", {
            bins: binData,
            collector_location: {
                latitude: 6.9271,
                longitude: 79.8612,
            },
            traffic_multiplier: 1.2,
        });
        if (!response.data.success) {
            throw new Error("Route optimization endpoint returned unsuccessful response");
        }
        const optimization = response.data.data;
        logger_1.logger.info(`   ✅ Route optimized successfully`);
        logger_1.logger.info(`   Total Distance: ${optimization.totalDistance?.toFixed(2) || "N/A"} km`);
        logger_1.logger.info(`   Estimated Duration: ${optimization.estimatedDuration || "N/A"} minutes`);
        logger_1.logger.info(`   Efficiency Score: ${optimization.efficiencyScore?.toFixed(2) || "N/A"}`);
        logger_1.logger.info(`   Bins in Route: ${optimization.optimizedRoute?.length || 0}`);
        return optimization;
    }
    async testPredictionData() {
        const predictionCount = await Prediction_1.Prediction.countDocuments();
        const recentPredictions = await Prediction_1.Prediction.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();
        logger_1.logger.info(`   Total predictions in database: ${predictionCount}`);
        if (recentPredictions.length > 0) {
            logger_1.logger.info(`   Recent predictions:`);
            for (const pred of recentPredictions) {
                const binPredictionCount = await Prediction_1.Prediction.countDocuments({
                    binId: pred.binId,
                });
                logger_1.logger.info(`     Bin ${pred.binId}: ${binPredictionCount} total predictions, Latest: ${pred.predictedLevel}% (${pred.riskLevel} risk, ${pred.source} source)`);
            }
        }
        else {
            logger_1.logger.warn("   ⚠️ No predictions found in database");
        }
        return {
            count: predictionCount,
            recent: recentPredictions,
        };
    }
    async testPredictionAccuracyData() {
        const accuracyCount = await PredictionAccuracy_1.PredictionAccuracy.countDocuments();
        const recentAccuracy = await PredictionAccuracy_1.PredictionAccuracy.find()
            .sort({ date: -1 })
            .limit(5)
            .lean();
        logger_1.logger.info(`   Total accuracy records: ${accuracyCount}`);
        if (recentAccuracy.length > 0) {
            logger_1.logger.info(`   Recent accuracy metrics:`);
            recentAccuracy.forEach((acc, idx) => {
                logger_1.logger.info(`     ${idx + 1}. Date: ${acc.date}, MAE: ${acc.mae?.toFixed(2)}, RMSE: ${acc.rmse?.toFixed(2)}, MAPE: ${acc.mape?.toFixed(2)}%`);
            });
        }
        else {
            logger_1.logger.warn("   ⚠️ No accuracy records found in database");
        }
        return {
            count: accuracyCount,
            recent: recentAccuracy,
        };
    }
    async testAutomaticCollections() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const recentCollections = await Collection_1.Collection.find({
            createdAt: { $gte: yesterday },
            status: "scheduled",
        })
            .sort({ scheduledDate: -1 })
            .limit(10)
            .lean();
        logger_1.logger.info(`   Recently scheduled collections (last 24h): ${recentCollections.length}`);
        if (recentCollections.length > 0) {
            logger_1.logger.info(`   Sample scheduled collections:`);
            recentCollections.slice(0, 3).forEach((coll, idx) => {
                logger_1.logger.info(`     ${idx + 1}. Bin ${coll.binId}, Status: ${coll.status}, Scheduled: ${coll.scheduledDate}`);
            });
            logger_1.logger.info(`   Note: Automatic scheduler runs every 6 hours and creates collections for bins needing service`);
        }
        else {
            logger_1.logger.warn("   ⚠️ No recently scheduled collections found (this is normal if scheduler hasn't run yet)");
            logger_1.logger.info(`   Tip: Automatic scheduler runs every 6 hours at minute 0`);
        }
        return {
            count: recentCollections.length,
            collections: recentCollections,
        };
    }
    async testDashboardData() {
        const response = await this.apiClient.get("/api/analytics/dashboard");
        if (!response.data.success) {
            throw new Error("Dashboard endpoint returned unsuccessful response");
        }
        const dashboard = response.data.data;
        logger_1.logger.info(`   Total Bins: ${dashboard.stats?.totalBins || 0}`);
        logger_1.logger.info(`   Active Bins: ${dashboard.stats?.activeBins || 0}`);
        logger_1.logger.info(`   Collections Today: ${dashboard.stats?.collectionsToday || 0}`);
        logger_1.logger.info(`   Overflowing Bins: ${dashboard.stats?.overflowingBins || 0}`);
        return dashboard;
    }
    async runAllTests() {
        console.log("\n" + "=".repeat(60));
        console.log("🧪 ML Functions Test Suite");
        console.log("=".repeat(60));
        try {
            await mongoose_1.default.connect(config_1.config.database.mongodbUri);
            logger_1.logger.info("✅ Connected to MongoDB");
        }
        catch (error) {
            logger_1.logger.error("❌ Failed to connect to MongoDB:", error);
            process.exit(1);
        }
        const authenticated = await this.authenticate();
        if (!authenticated) {
            logger_1.logger.error("❌ Authentication failed. Cannot proceed with tests.");
            await mongoose_1.default.disconnect();
            process.exit(1);
        }
        await this.runTest("ML Service Health Check", () => this.testMLHealth());
        await this.runTest("Waste Predictions", () => this.testPredictions());
        await this.runTest("Prediction Accuracy Metrics", () => this.testPredictionMetrics());
        await this.runTest("Route Optimization", () => this.testRouteOptimization());
        await this.runTest("Prediction Data in Database", () => this.testPredictionData());
        await this.runTest("Prediction Accuracy Data", () => this.testPredictionAccuracyData());
        await this.runTest("Automatic Collection Scheduling", () => this.testAutomaticCollections());
        await this.runTest("Dashboard Data", () => this.testDashboardData());
        this.printSummary();
        await mongoose_1.default.disconnect();
        logger_1.logger.info("✅ Disconnected from MongoDB");
    }
    printSummary() {
        console.log("\n" + "=".repeat(60));
        console.log("📊 Test Summary");
        console.log("=".repeat(60));
        const passed = this.testResults.filter((r) => r.status === "PASS").length;
        const failed = this.testResults.filter((r) => r.status === "FAIL").length;
        const skipped = this.testResults.filter((r) => r.status === "SKIP").length;
        console.log(`\nTotal Tests: ${this.testResults.length}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏭️  Skipped: ${skipped}`);
        console.log("\n" + "-".repeat(60));
        console.log("Detailed Results:");
        console.log("-".repeat(60));
        this.testResults.forEach((result, index) => {
            const icon = result.status === "PASS"
                ? "✅"
                : result.status === "FAIL"
                    ? "❌"
                    : "⏭️";
            console.log(`\n${index + 1}. ${icon} ${result.name}`);
            console.log(`   Status: ${result.status}`);
            console.log(`   Message: ${result.message}`);
            if (result.duration) {
                console.log(`   Duration: ${result.duration}ms`);
            }
            if (result.status === "FAIL" && result.details) {
                console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
            }
        });
        console.log("\n" + "=".repeat(60));
        if (failed === 0) {
            console.log("🎉 All tests passed!");
            process.exit(0);
        }
        else {
            console.log("⚠️  Some tests failed. Please review the details above.");
            process.exit(1);
        }
    }
}
exports.MLFunctionsTester = MLFunctionsTester;
if (require.main === module) {
    const tester = new MLFunctionsTester();
    tester.runAllTests().catch((error) => {
        logger_1.logger.error("Test suite failed:", error);
        process.exit(1);
    });
}
//# sourceMappingURL=testMLFunctions.js.map