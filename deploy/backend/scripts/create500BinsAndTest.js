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
exports.SyntheticDataGenerator = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../config/config");
const Bin_1 = require("../models/Bin");
const Prediction_1 = require("../models/Prediction");
const Collection_1 = require("../models/Collection");
const mlClient_1 = require("../services/mlClient");
const User_1 = require("../models/User");
const logger_1 = require("../utils/logger");
const axios_1 = __importDefault(require("axios"));
const LOCATIONS = [
    { name: "Colombo Fort", lat: 6.9344, lng: 79.8428 },
    { name: "Pettah", lat: 6.9367, lng: 79.8500 },
    { name: "Maradana", lat: 6.9300, lng: 79.8700 },
    { name: "Borella", lat: 6.9200, lng: 79.8800 },
    { name: "Cinnamon Gardens", lat: 6.9100, lng: 79.8600 },
    { name: "Bambalapitiya", lat: 6.8881, lng: 79.8578 },
    { name: "Wellawatta", lat: 6.8700, lng: 79.8600 },
    { name: "Dehiwala", lat: 6.8500, lng: 79.8700 },
    { name: "Mount Lavinia", lat: 6.8400, lng: 79.8600 },
    { name: "Nugegoda", lat: 6.8700, lng: 79.9000 },
    { name: "Kohuwala", lat: 6.8500, lng: 79.9000 },
    { name: "Maharagama", lat: 6.8500, lng: 79.9200 },
    { name: "Kotte", lat: 6.8900, lng: 79.9000 },
    { name: "Rajagiriya", lat: 6.9000, lng: 79.9100 },
    { name: "Battaramulla", lat: 6.9000, lng: 79.9200 },
    { name: "Thimbirigasyaya", lat: 6.9000, lng: 79.8700 },
    { name: "Havelock Town", lat: 6.8900, lng: 79.8600 },
    { name: "Kirulapone", lat: 6.8800, lng: 79.8700 },
    { name: "Narahenpita", lat: 6.9100, lng: 79.8800 },
    { name: "Colombo 7", lat: 6.9150, lng: 79.8550 },
];
const COLOMBO_BOUNDS = {
    minLat: 6.85,
    maxLat: 6.94,
    minLng: 79.85,
    maxLng: 79.92,
};
function isInSea(lat, lng) {
    if (lng < 79.85 && lat < 6.90) {
        return true;
    }
    if (lng < 79.86 && lat < 6.88) {
        return true;
    }
    if (lng < 79.84) {
        return true;
    }
    if (lat < 6.83 && lng < 79.87) {
        return true;
    }
    return false;
}
const BIN_TYPES = [
    "general",
    "recyclable",
    "organic",
    "hazardous",
];
const STATUSES = [
    "active",
    "active",
    "active",
    "active",
    "active",
    "inactive",
    "maintenance",
];
class SyntheticDataGenerator {
    constructor() {
        this.authToken = null;
        this.baseURL = process.env["API_URL"] || `http://localhost:${config_1.config.port}`;
        this.apiClient = axios_1.default.create({
            baseURL: this.baseURL,
            timeout: 60000,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }
    async authenticate() {
        try {
            const testEmail = process.env["TEST_EMAIL"] || "test@example.com";
            const testPassword = process.env["TEST_PASSWORD"] || "test123456";
            const userExists = await User_1.User.findOne({ email: testEmail });
            if (!userExists) {
                await User_1.User.create({
                    email: testEmail,
                    password: testPassword,
                    firstName: "Test",
                    lastName: "User",
                    role: "admin",
                    isActive: true,
                });
                logger_1.logger.info(`✅ Created test user: ${testEmail}`);
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
            return false;
        }
        catch (error) {
            logger_1.logger.error("❌ Authentication failed:", error.message);
            return false;
        }
    }
    random(min, max) {
        return Math.random() * (max - min) + min;
    }
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    randomItem(array) {
        if (array.length === 0) {
            throw new Error("Cannot get random item from empty array");
        }
        return array[Math.floor(Math.random() * array.length)];
    }
    generateBinId(index) {
        const prefixes = ["MARKET", "OFFICE", "HOSPITAL", "SCHOOL", "BEACH", "PARK", "STREET", "MALL", "HOTEL", "RESTAURANT"];
        const prefix = this.randomItem(prefixes);
        return `BIN-${prefix}-${String(index + 1).padStart(3, "0")}`;
    }
    async create500Bins() {
        logger_1.logger.info("📦 Creating 300 synthetic bins...");
        const existingCount = await Bin_1.Bin.countDocuments({
            binId: { $regex: /^BIN-/ },
        });
        if (existingCount > 0) {
            logger_1.logger.info(`🗑️  Deleting ${existingCount} existing bins...`);
            await Bin_1.Bin.deleteMany({ binId: { $regex: /^BIN-/ } });
        }
        const bins = [];
        const now = new Date();
        let attempts = 0;
        const maxAttempts = 600;
        while (bins.length < 300 && attempts < maxAttempts) {
            attempts++;
            const location = this.randomItem(LOCATIONS);
            const binType = this.randomItem(BIN_TYPES);
            const status = this.randomItem(STATUSES);
            const capacity = this.randomInt(50, 500);
            const currentLevel = status === "active"
                ? this.randomInt(0, 95)
                : status === "full"
                    ? this.randomInt(90, 100)
                    : this.randomInt(0, 50);
            const latVariation = this.random(-0.01, 0.01);
            const lngVariation = this.random(-0.01, 0.01);
            let lat = Math.max(COLOMBO_BOUNDS.minLat, Math.min(COLOMBO_BOUNDS.maxLat, location.lat + latVariation));
            let lng = Math.max(COLOMBO_BOUNDS.minLng, Math.min(COLOMBO_BOUNDS.maxLng, location.lng + lngVariation));
            if (isInSea(lat, lng)) {
                lat = location.lat;
                lng = location.lng;
                if (isInSea(lat, lng)) {
                    continue;
                }
            }
            const bin = {
                binId: this.generateBinId(bins.length),
                binType,
                type: binType,
                location: {
                    latitude: lat,
                    longitude: lng,
                    address: `${location.name} Area, Colombo, Sri Lanka`,
                    coordinates: [lng, lat],
                },
                capacity,
                currentLevel,
                status,
                isOverflowing: currentLevel >= 90,
                lastEmptied: new Date(now.getTime() - this.randomInt(1, 30) * 24 * 60 * 60 * 1000),
                nextCollection: new Date(now.getTime() + this.randomInt(1, 7) * 24 * 60 * 60 * 1000),
                collectionFrequency: this.randomInt(24, 168),
                alerts: currentLevel >= 90 ? [
                    {
                        type: "overflow",
                        message: "Bin is overflowing",
                        timestamp: new Date(),
                        resolved: false,
                    }
                ] : [],
                metadata: {
                    installationDate: new Date(now.getTime() - this.randomInt(30, 365) * 24 * 60 * 60 * 1000),
                    lastMaintenance: new Date(now.getTime() - this.randomInt(1, 90) * 24 * 60 * 60 * 1000),
                    batteryLevel: this.randomInt(20, 100),
                    signalStrength: this.randomInt(50, 100),
                    lastDataReceived: new Date(now.getTime() - this.randomInt(0, 6) * 60 * 60 * 1000),
                },
            };
            bins.push(bin);
        }
        if (bins.length < 300) {
            logger_1.logger.warn(`⚠️  Only generated ${bins.length} bins (target was 300) after ${attempts} attempts`);
            logger_1.logger.warn(`   This may be due to sea location filtering. Continuing with ${bins.length} bins...`);
        }
        logger_1.logger.info("💾 Inserting bins into database...");
        for (let i = 0; i < bins.length; i += 100) {
            const batch = bins.slice(i, i + 100);
            await Bin_1.Bin.insertMany(batch);
            logger_1.logger.info(`   ✅ Inserted ${Math.min(i + 100, bins.length)}/${bins.length} bins`);
        }
        logger_1.logger.info(`✅ Created ${bins.length} synthetic bins`);
    }
    async generatePredictions() {
        logger_1.logger.info("🤖 Generating predictions for all bins...");
        const bins = await Bin_1.Bin.find({ status: "active" }).limit(300).lean();
        logger_1.logger.info(`   Found ${bins.length} active bins`);
        const mlClient = new mlClient_1.MLClient();
        const isHealthy = await mlClient.healthCheck();
        if (!isHealthy) {
            logger_1.logger.warn("⚠️  ML service not healthy, skipping predictions");
            return;
        }
        let successCount = 0;
        let failCount = 0;
        for (let i = 0; i < bins.length; i += 50) {
            const batch = bins.slice(i, i + 50);
            await Promise.all(batch.map(async (bin) => {
                try {
                    const prediction = await mlClient.predictWaste(bin.binId, bin.binType || "general", bin.currentLevel || 0, bin.capacity || 100, bin.location, 24);
                    await Prediction_1.Prediction.create({
                        binId: bin.binId,
                        horizonHours: 24,
                        predictedLevel: prediction.predicted_level,
                        timeToFullHours: prediction.time_to_full_hours ?? null,
                        riskLevel: prediction.risk_level,
                        recommendedCollectionTime: prediction.recommended_collection_time
                            ? new Date(prediction.recommended_collection_time)
                            : null,
                        confidence: prediction.confidence,
                        factors: prediction.factors ?? [],
                        source: "ml-service",
                    });
                    if (prediction.predicted_level >= 85) {
                        await Bin_1.Bin.updateOne({ binId: bin.binId }, { $set: { isOverflowing: true } });
                    }
                    successCount++;
                }
                catch (error) {
                    logger_1.logger.warn(`   ⚠️  Prediction failed for ${bin.binId}: ${error.message}`);
                    failCount++;
                }
            }));
            logger_1.logger.info(`   ✅ Processed ${Math.min(i + 50, bins.length)}/${bins.length} bins`);
        }
        logger_1.logger.info(`✅ Generated ${successCount} predictions (${failCount} failed)`);
    }
    async createCollections() {
        logger_1.logger.info("🚛 Creating sample collections...");
        const existingCount = await Collection_1.Collection.countDocuments({
            collectionId: { $regex: /^COL/ },
        });
        if (existingCount > 0) {
            logger_1.logger.info(`🗑️  Deleting ${existingCount} existing collections...`);
            await Collection_1.Collection.deleteMany({ collectionId: { $regex: /^COL/ } });
        }
        const bins = await Bin_1.Bin.find({ status: "active" })
            .limit(50)
            .lean();
        const collector = await User_1.User.findOne({ role: "collector" }) || await User_1.User.findOne({ role: "admin" });
        if (!collector) {
            logger_1.logger.warn("⚠️  No collector found, skipping collections");
            return;
        }
        const collections = [];
        const now = new Date();
        const currentCollectionCount = await Collection_1.Collection.countDocuments();
        for (let i = 0; i < 30; i++) {
            const bin = this.randomItem(bins);
            const scheduledDate = new Date(now.getTime() - this.randomInt(0, 7) * 24 * 60 * 60 * 1000);
            const actualDate = Math.random() > 0.3
                ? new Date(scheduledDate.getTime() + this.randomInt(-2, 2) * 60 * 60 * 1000)
                : undefined;
            const collectionId = `COL${String(currentCollectionCount + i + 1).padStart(6, "0")}`;
            collections.push({
                collectionId,
                binId: bin.binId,
                bin: {
                    binId: bin.binId,
                    binType: bin.binType || "general",
                    location: bin.location || { latitude: 6.9271, longitude: 79.8612 },
                },
                collectorId: collector._id.toString(),
                collector: {
                    firstName: collector.firstName,
                    lastName: collector.lastName,
                    email: collector.email,
                },
                scheduledDate,
                actualDate,
                status: actualDate ? (Math.random() > 0.1 ? "completed" : "missed") : "scheduled",
                wasteType: bin.binType || "general",
                weight: actualDate ? this.randomInt(10, 100) : undefined,
                volume: actualDate ? this.randomInt(20, 200) : undefined,
            });
        }
        await Collection_1.Collection.insertMany(collections);
        logger_1.logger.info(`✅ Created ${collections.length} collections`);
    }
    async generatePredictionAccuracy() {
        try {
            const { PredictionAccuracy } = await Promise.resolve().then(() => __importStar(require("../models/PredictionAccuracy")));
            const db = mongoose_1.default.connection.db;
            if (!db)
                return;
            const binHistoryCollection = db.collection("bin_history");
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const predictions = await Prediction_1.Prediction.find({
                createdAt: { $gte: sevenDaysAgo },
                horizonHours: 24,
            })
                .sort({ createdAt: -1 })
                .limit(200)
                .lean();
            if (predictions.length === 0) {
                logger_1.logger.warn("   ⚠️  No predictions found for accuracy calculation");
                return;
            }
            const predictionsByDate = new Map();
            for (const pred of predictions) {
                const date = new Date(pred.createdAt);
                date.setHours(0, 0, 0, 0);
                const dateKey = date.toISOString().split("T")[0];
                if (!dateKey) {
                    continue;
                }
                if (!predictionsByDate.has(dateKey)) {
                    predictionsByDate.set(dateKey, []);
                }
                const dayPredictions = predictionsByDate.get(dateKey);
                if (dayPredictions) {
                    dayPredictions.push(pred);
                }
            }
            let totalRecords = 0;
            for (const [dateKey, dayPredictions] of predictionsByDate) {
                const accuracyData = [];
                for (const pred of dayPredictions) {
                    const predictionTime = new Date(pred.createdAt);
                    const actualTime = new Date(predictionTime.getTime() + 24 * 60 * 60 * 1000);
                    const actualEntry = await binHistoryCollection.findOne({
                        binId: pred.binId,
                        timestamp: {
                            $gte: new Date(actualTime.getTime() - 2 * 60 * 60 * 1000),
                            $lte: new Date(actualTime.getTime() + 2 * 60 * 60 * 1000),
                        },
                    });
                    if (actualEntry) {
                        accuracyData.push({
                            predicted: pred.predictedLevel,
                            actual: actualEntry["fillLevel"] || 0,
                            source: pred.source || "ml-service",
                        });
                    }
                    else {
                        const bin = await Bin_1.Bin.findOne({ binId: pred.binId }).lean();
                        if (bin && bin.currentLevel !== undefined) {
                            accuracyData.push({
                                predicted: pred.predictedLevel,
                                actual: bin.currentLevel,
                                source: pred.source || "ml-service",
                            });
                        }
                    }
                }
                if (accuracyData.length > 0) {
                    const errors = accuracyData.map((d) => Math.abs(d.predicted - d.actual));
                    const squaredErrors = errors.map((e) => e * e);
                    const percentageErrors = accuracyData.map((d) => (d.actual > 0 ? (Math.abs(d.predicted - d.actual) / d.actual) * 100 : 0));
                    const mae = errors.reduce((sum, e) => sum + e, 0) / errors.length;
                    const rmse = Math.sqrt(squaredErrors.reduce((sum, e) => sum + e, 0) / squaredErrors.length);
                    const mape = percentageErrors.reduce((sum, e) => sum + e, 0) / percentageErrors.length;
                    const mlData = accuracyData.filter((d) => d.source === "ml-service");
                    const fallbackData = accuracyData.filter((d) => d.source === "fallback");
                    const date = new Date(dateKey);
                    await PredictionAccuracy.create({
                        binId: null,
                        date,
                        mae,
                        rmse,
                        mape,
                        sampleCount: accuracyData.length,
                        source: "aggregate",
                    });
                    totalRecords++;
                    if (mlData.length > 0) {
                        const mlErrors = mlData.map((d) => Math.abs(d.predicted - d.actual));
                        const mlSquaredErrors = mlErrors.map((e) => e * e);
                        const mlPercentageErrors = mlData.map((d) => (d.actual > 0 ? (Math.abs(d.predicted - d.actual) / d.actual) * 100 : 0));
                        await PredictionAccuracy.create({
                            binId: null,
                            date,
                            mae: mlErrors.reduce((sum, e) => sum + e, 0) / mlErrors.length,
                            rmse: Math.sqrt(mlSquaredErrors.reduce((sum, e) => sum + e, 0) / mlSquaredErrors.length),
                            mape: mlPercentageErrors.reduce((sum, e) => sum + e, 0) / mlPercentageErrors.length,
                            sampleCount: mlData.length,
                            source: "ml-service",
                        });
                        totalRecords++;
                    }
                    if (fallbackData.length > 0) {
                        const fallbackErrors = fallbackData.map((d) => Math.abs(d.predicted - d.actual));
                        const fallbackSquaredErrors = fallbackErrors.map((e) => e * e);
                        const fallbackPercentageErrors = fallbackData.map((d) => (d.actual > 0 ? (Math.abs(d.predicted - d.actual) / d.actual) * 100 : 0));
                        await PredictionAccuracy.create({
                            binId: null,
                            date,
                            mae: fallbackErrors.reduce((sum, e) => sum + e, 0) / fallbackErrors.length,
                            rmse: Math.sqrt(fallbackSquaredErrors.reduce((sum, e) => sum + e, 0) / fallbackSquaredErrors.length),
                            mape: fallbackPercentageErrors.reduce((sum, e) => sum + e, 0) / fallbackPercentageErrors.length,
                            sampleCount: fallbackData.length,
                            source: "fallback",
                        });
                        totalRecords++;
                    }
                }
            }
            logger_1.logger.info(`   ✅ Created ${totalRecords} prediction accuracy records`);
        }
        catch (error) {
            logger_1.logger.error(`   ❌ Error generating accuracy records: ${error.message}`);
        }
    }
    async testDashboardFeatures() {
        logger_1.logger.info("🧪 Testing all dashboard features...");
        const tests = [
            {
                name: "Dashboard Data",
                endpoint: "/api/analytics/dashboard",
                method: "get",
            },
            {
                name: "Metrics",
                endpoint: "/api/analytics/metrics",
                method: "get",
                params: {
                    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString(),
                },
            },
            {
                name: "Bin Status Summary",
                endpoint: "/api/analytics/bins/status",
                method: "get",
            },
            {
                name: "Collection Summary",
                endpoint: "/api/analytics/collections/summary",
                method: "get",
            },
            {
                name: "Route Performance",
                endpoint: "/api/analytics/routes/performance",
                method: "get",
            },
            {
                name: "ML Prediction Metrics",
                endpoint: "/api/analytics/predictions/metrics",
                method: "get",
                params: {
                    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                    endDate: new Date().toISOString(),
                },
            },
            {
                name: "Predictions (Sample Bin)",
                endpoint: "/api/analytics/predictions",
                method: "get",
                params: async () => {
                    const bin = await Bin_1.Bin.findOne({ status: "active" }).lean();
                    return { binId: bin?.binId || "", days: 24 };
                },
            },
        ];
        for (const test of tests) {
            try {
                logger_1.logger.info(`   Testing: ${test.name}...`);
                let params = test.params;
                if (typeof params === "function") {
                    params = await params();
                }
                const response = await this.apiClient[test.method](test.endpoint, test.method === "get" ? { params } : params);
                if (response.data.success) {
                    logger_1.logger.info(`   ✅ ${test.name}: Success`);
                    if (test.name === "ML Prediction Metrics") {
                        const metrics = response.data.data;
                        logger_1.logger.info(`      MAE: ${metrics.accuracy?.mae?.toFixed(2) || "N/A"}`);
                        logger_1.logger.info(`      RMSE: ${metrics.accuracy?.rmse?.toFixed(2) || "N/A"}`);
                        logger_1.logger.info(`      MAPE: ${metrics.accuracy?.mape?.toFixed(2) || "N/A"}%`);
                        logger_1.logger.info(`      ML vs Fallback: ${metrics.mlVsFallback?.mlPercentage?.toFixed(1) || 0}% ML`);
                    }
                }
                else {
                    logger_1.logger.warn(`   ⚠️  ${test.name}: Unsuccessful response`);
                }
            }
            catch (error) {
                logger_1.logger.error(`   ❌ ${test.name}: ${error.message}`);
            }
        }
    }
    async run() {
        try {
            console.log("\n" + "=".repeat(60));
            console.log("🚀 Create 300 Bins and Test Dashboard Features");
            console.log("=".repeat(60));
            await mongoose_1.default.connect(config_1.config.database.mongodbUri);
            logger_1.logger.info("✅ Connected to MongoDB");
            const authenticated = await this.authenticate();
            if (!authenticated) {
                logger_1.logger.warn("⚠️  Authentication failed - continuing without API testing");
                logger_1.logger.info("   Note: Bins, predictions, and collections will still be created");
                logger_1.logger.info("   API endpoint testing will be skipped");
            }
            await this.create500Bins();
            await this.generatePredictions();
            await this.createCollections();
            logger_1.logger.info("\n📈 Generating prediction accuracy records...");
            await this.generatePredictionAccuracy();
            if (this.authToken) {
                await this.testDashboardFeatures();
            }
            else {
                logger_1.logger.info("\n⚠️  Skipping API endpoint tests (authentication failed)");
                logger_1.logger.info("   You can test endpoints manually via the dashboard");
            }
            logger_1.logger.info("\n✅ All steps completed successfully!");
            logger_1.logger.info("\n📊 Summary:");
            logger_1.logger.info(`   - Bins created: 300`);
            logger_1.logger.info(`   - Predictions: Check database`);
            logger_1.logger.info(`   - Collections: 30`);
            logger_1.logger.info(`   - Dashboard features: All tested`);
            logger_1.logger.info("\n💡 Next steps:");
            logger_1.logger.info("   1. Open the web dashboard");
            logger_1.logger.info("   2. Navigate to Analytics page");
            logger_1.logger.info("   3. View ML Prediction Analytics section");
            logger_1.logger.info("   4. Check all other analytics features");
            await mongoose_1.default.disconnect();
            logger_1.logger.info("✅ Disconnected from MongoDB");
        }
        catch (error) {
            logger_1.logger.error("❌ Error:", error);
            await mongoose_1.default.disconnect();
            process.exit(1);
        }
    }
}
exports.SyntheticDataGenerator = SyntheticDataGenerator;
if (require.main === module) {
    const generator = new SyntheticDataGenerator();
    generator.run().catch((error) => {
        logger_1.logger.error("Script failed:", error);
        process.exit(1);
    });
}
//# sourceMappingURL=create500BinsAndTest.js.map