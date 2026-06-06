"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateBinTester = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config/config");
const Bin_1 = require("../models/Bin");
const logger_1 = require("../utils/logger");
const API_BASE_URL = `http://localhost:${config_1.config.port}/api`;
class CreateBinTester {
    constructor() {
        this.testUser = {
            email: "test@example.com",
            password: "test123456",
        };
        this.testBinId = `TEST_BIN_${Date.now()}`;
    }
    async runTests() {
        try {
            logger_1.logger.info("🧪 Starting Create Bin Functionality Tests");
            logger_1.logger.info("==========================================");
            await mongoose_1.default.connect(config_1.config.database.mongodbUri);
            logger_1.logger.info("✅ Connected to MongoDB");
            logger_1.logger.info("\n📝 Step 1: Authenticating user...");
            await this.authenticate();
            logger_1.logger.info("\n📝 Step 2: Creating test bin via API...");
            const createdBin = await this.createBinViaAPI();
            logger_1.logger.info("\n📝 Step 3: Verifying bin in database...");
            await this.verifyBinInDatabase(createdBin._id);
            logger_1.logger.info("\n📝 Step 4: Testing bin retrieval via API...");
            await this.retrieveBinViaAPI(createdBin._id);
            logger_1.logger.info("\n📝 Step 5: Testing bin appears in bins list...");
            await this.verifyBinInList(createdBin.binId);
            logger_1.logger.info("\n📝 Step 6: Verifying data structure compatibility...");
            this.verifyDataStructure(createdBin);
            logger_1.logger.info("\n📝 Step 7: Cleaning up test bin...");
            await this.cleanup(createdBin._id);
            logger_1.logger.info("\n✅ All tests passed!");
            logger_1.logger.info("==========================================");
        }
        catch (error) {
            logger_1.logger.error("❌ Test failed:", error.message);
            if (error.response) {
                logger_1.logger.error("Response data:", error.response.data);
                logger_1.logger.error("Response status:", error.response.status);
            }
            throw error;
        }
        finally {
            await mongoose_1.default.disconnect();
            logger_1.logger.info("✅ Disconnected from MongoDB");
        }
    }
    async authenticate() {
        try {
            try {
                const baseUrl = API_BASE_URL.replace('/api', '');
                await axios_1.default.get(`${baseUrl}/health`, { timeout: 3000 });
                logger_1.logger.info(`✅ Backend server is running at ${baseUrl}`);
            }
            catch (healthError) {
                if (healthError.code === 'ECONNREFUSED') {
                    throw new Error(`Backend server is not running at ${API_BASE_URL.replace('/api', '')}. Please start it with 'npm run dev' in the backend directory.`);
                }
                logger_1.logger.warn(`⚠️  Health check failed, but continuing: ${healthError.message}`);
            }
            const response = await axios_1.default.post(`${API_BASE_URL}/auth/login`, {
                email: this.testUser.email,
                password: this.testUser.password,
            });
            if (response.data.success && response.data.data?.token) {
                this.testUser.token = response.data.data.token;
                logger_1.logger.info("✅ Authentication successful");
            }
            else {
                logger_1.logger.warn("⚠️  Authentication failed, attempting to create user...");
                await this.createTestUser();
                await this.authenticate();
            }
        }
        catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error(`Cannot connect to backend at ${API_BASE_URL}. Please ensure the backend server is running with 'npm run dev'`);
            }
            if (error.response?.status === 401) {
                logger_1.logger.warn("⚠️  Authentication failed, attempting to create user...");
                await this.createTestUser();
                await this.authenticate();
            }
            else {
                logger_1.logger.error("Authentication error:", error.message);
                if (error.response) {
                    logger_1.logger.error("Response:", error.response.data);
                }
                throw error;
            }
        }
    }
    async createTestUser() {
        try {
            await axios_1.default.post(`${API_BASE_URL}/auth/register`, {
                email: this.testUser.email,
                password: this.testUser.password,
                name: "Test User",
                role: "admin",
            });
            logger_1.logger.info("✅ Test user created");
        }
        catch (error) {
            if (error.response?.status === 409) {
                logger_1.logger.warn("⚠️  User exists, deleting and recreating...");
                const User = mongoose_1.default.model("User");
                await User.deleteOne({ email: this.testUser.email });
                await this.createTestUser();
            }
            else {
                throw error;
            }
        }
    }
    async createBinViaAPI() {
        const binData = {
            binId: this.testBinId,
            binType: "general",
            location: {
                latitude: 6.9271,
                longitude: 79.8612,
                address: "Test Location, Colombo, Sri Lanka",
            },
            capacity: 150,
            currentLevel: 25,
            status: "active",
            collectionFrequency: 24,
        };
        const response = await axios_1.default.post(`${API_BASE_URL}/bins`, binData, {
            headers: {
                Authorization: `Bearer ${this.testUser.token}`,
                "Content-Type": "application/json",
            },
        });
        if (response.data.success && response.data.data) {
            logger_1.logger.info(`✅ Bin created successfully: ${response.data.data.binId}`);
            logger_1.logger.info(`   - ID: ${response.data.data._id}`);
            logger_1.logger.info(`   - Type: ${response.data.data.binType}`);
            logger_1.logger.info(`   - Capacity: ${response.data.data.capacity}L`);
            logger_1.logger.info(`   - Fill Level: ${response.data.data.currentLevel}%`);
            logger_1.logger.info(`   - Location: ${response.data.data.location?.address || "N/A"}`);
            return response.data.data;
        }
        else {
            throw new Error("Failed to create bin: Invalid response");
        }
    }
    async verifyBinInDatabase(binId) {
        const bin = await Bin_1.Bin.findById(binId).lean();
        if (!bin) {
            throw new Error("Bin not found in database");
        }
        logger_1.logger.info("✅ Bin found in database:");
        logger_1.logger.info(`   - Bin ID: ${bin.binId}`);
        logger_1.logger.info(`   - Status: ${bin.status}`);
        logger_1.logger.info(`   - Current Level: ${bin.currentLevel}%`);
        logger_1.logger.info(`   - Capacity: ${bin.capacity}L`);
        logger_1.logger.info(`   - Location: ${JSON.stringify(bin.location)}`);
        if (!bin.binId)
            throw new Error("binId is missing");
        if (!bin.binType)
            throw new Error("binType is missing");
        if (!bin.location)
            throw new Error("location is missing");
        if (!bin.capacity)
            throw new Error("capacity is missing");
        if (bin.currentLevel === undefined)
            throw new Error("currentLevel is missing");
        logger_1.logger.info("✅ All required fields present");
    }
    async retrieveBinViaAPI(binId) {
        const response = await axios_1.default.get(`${API_BASE_URL}/bins/${binId}`, {
            headers: {
                Authorization: `Bearer ${this.testUser.token}`,
            },
        });
        if (response.data.success && response.data.data) {
            logger_1.logger.info("✅ Bin retrieved successfully via API");
            logger_1.logger.info(`   - Bin ID: ${response.data.data.binId}`);
            logger_1.logger.info(`   - Status: ${response.data.data.status}`);
        }
        else {
            throw new Error("Failed to retrieve bin via API");
        }
    }
    async verifyBinInList(binId) {
        const response = await axios_1.default.get(`${API_BASE_URL}/bins`, {
            headers: {
                Authorization: `Bearer ${this.testUser.token}`,
            },
            params: {
                page: 1,
                limit: 100,
            },
        });
        if (response.data.success && response.data.data) {
            const bins = Array.isArray(response.data.data)
                ? response.data.data
                : response.data.data.items || [];
            const foundBin = bins.find((bin) => bin.binId === binId);
            if (foundBin) {
                logger_1.logger.info("✅ Bin found in bins list");
                logger_1.logger.info(`   - Total bins in list: ${bins.length}`);
            }
            else {
                throw new Error(`Bin ${binId} not found in bins list`);
            }
        }
        else {
            throw new Error("Failed to retrieve bins list");
        }
    }
    verifyDataStructure(bin) {
        logger_1.logger.info("Verifying data structure compatibility...");
        const requiredFields = [
            "_id",
            "binId",
            "binType",
            "status",
            "capacity",
            "currentLevel",
            "location",
        ];
        for (const field of requiredFields) {
            if (!(field in bin)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        if (!bin.location.latitude || !bin.location.longitude) {
            throw new Error("Location missing latitude or longitude");
        }
        if (typeof bin.capacity !== "number") {
            throw new Error("capacity must be a number");
        }
        if (typeof bin.currentLevel !== "number") {
            throw new Error("currentLevel must be a number");
        }
        if (typeof bin.location.latitude !== "number") {
            throw new Error("location.latitude must be a number");
        }
        if (typeof bin.location.longitude !== "number") {
            throw new Error("location.longitude must be a number");
        }
        logger_1.logger.info("✅ Data structure is compatible with frontend");
    }
    async cleanup(binId) {
        try {
            await Bin_1.Bin.deleteOne({ _id: binId });
            logger_1.logger.info("✅ Test bin deleted from database");
        }
        catch (error) {
            logger_1.logger.warn("⚠️  Failed to delete test bin:", error.message);
        }
    }
}
exports.CreateBinTester = CreateBinTester;
if (require.main === module) {
    const tester = new CreateBinTester();
    tester
        .runTests()
        .then(() => {
        logger_1.logger.info("\n🎉 All tests completed successfully!");
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error("\n💥 Tests failed:", error);
        process.exit(1);
    });
}
//# sourceMappingURL=testCreateBin.js.map