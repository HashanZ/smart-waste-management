/**
 * Test script to verify "Add New Bin" functionality
 * Tests:
 * 1. API endpoint for creating bins
 * 2. Database storage
 * 3. Data retrieval
 * 4. Frontend compatibility
 */

import mongoose from "mongoose";
import axios from "axios";
import { config } from "../config/config";
import { Bin } from "../models/Bin";
import { logger } from "../utils/logger";

const API_BASE_URL = `http://localhost:${config.port}/api`;

interface TestUser {
  email: string;
  password: string;
  token?: string;
}

class CreateBinTester {
  private testUser: TestUser = {
    email: "test@example.com",
    password: "test123456",
  };

  private testBinId = `TEST_BIN_${Date.now()}`;

  async runTests(): Promise<void> {
    try {
      logger.info("🧪 Starting Create Bin Functionality Tests");
      logger.info("==========================================");

      // Connect to MongoDB
      await mongoose.connect(config.database.mongodbUri);
      logger.info("✅ Connected to MongoDB");

      // Step 1: Authenticate
      logger.info("\n📝 Step 1: Authenticating user...");
      await this.authenticate();

      // Step 2: Create a test bin
      logger.info("\n📝 Step 2: Creating test bin via API...");
      const createdBin = await this.createBinViaAPI();

      // Step 3: Verify bin in database
      logger.info("\n📝 Step 3: Verifying bin in database...");
      await this.verifyBinInDatabase(createdBin._id);

      // Step 4: Test retrieving bin via API
      logger.info("\n📝 Step 4: Testing bin retrieval via API...");
      await this.retrieveBinViaAPI(createdBin._id);

      // Step 5: Test bin appears in list
      logger.info("\n📝 Step 5: Testing bin appears in bins list...");
      await this.verifyBinInList(createdBin.binId);

      // Step 6: Test bin data structure matches frontend expectations
      logger.info("\n📝 Step 6: Verifying data structure compatibility...");
      this.verifyDataStructure(createdBin);

      // Step 7: Cleanup - Delete test bin
      logger.info("\n📝 Step 7: Cleaning up test bin...");
      await this.cleanup(createdBin._id);

      logger.info("\n✅ All tests passed!");
      logger.info("==========================================");
    } catch (error: any) {
      logger.error("❌ Test failed:", error.message);
      if (error.response) {
        logger.error("Response data:", error.response.data);
        logger.error("Response status:", error.response.status);
      }
      throw error;
    } finally {
      await mongoose.disconnect();
      logger.info("✅ Disconnected from MongoDB");
    }
  }

  private async authenticate(): Promise<void> {
    try {
      // First check if backend is running
      try {
        const baseUrl = API_BASE_URL.replace('/api', '');
        await axios.get(`${baseUrl}/health`, { timeout: 3000 });
        logger.info(`✅ Backend server is running at ${baseUrl}`);
      } catch (healthError: any) {
        if (healthError.code === 'ECONNREFUSED') {
          throw new Error(
            `Backend server is not running at ${API_BASE_URL.replace('/api', '')}. Please start it with 'npm run dev' in the backend directory.`
          );
        }
        // Health check might fail for other reasons, but continue anyway
        logger.warn(`⚠️  Health check failed, but continuing: ${healthError.message}`);
      }

      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: this.testUser.email,
        password: this.testUser.password,
      });

      if (response.data.success && response.data.data?.token) {
        this.testUser.token = response.data.data.token;
        logger.info("✅ Authentication successful");
      } else {
        // Try to create user if authentication fails
        logger.warn("⚠️  Authentication failed, attempting to create user...");
        await this.createTestUser();
        await this.authenticate();
      }
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          `Cannot connect to backend at ${API_BASE_URL}. Please ensure the backend server is running with 'npm run dev'`
        );
      }
      if (error.response?.status === 401) {
        logger.warn("⚠️  Authentication failed, attempting to create user...");
        await this.createTestUser();
        await this.authenticate();
      } else {
        logger.error("Authentication error:", error.message);
        if (error.response) {
          logger.error("Response:", error.response.data);
        }
        throw error;
      }
    }
  }

  private async createTestUser(): Promise<void> {
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, {
        email: this.testUser.email,
        password: this.testUser.password,
        name: "Test User",
        role: "admin",
      });
      logger.info("✅ Test user created");
    } catch (error: any) {
      if (error.response?.status === 409) {
        // User already exists, try to delete and recreate
        logger.warn("⚠️  User exists, deleting and recreating...");
        const User = mongoose.model("User");
        await User.deleteOne({ email: this.testUser.email });
        await this.createTestUser();
      } else {
        throw error;
      }
    }
  }

  private async createBinViaAPI(): Promise<any> {
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

    const response = await axios.post(
      `${API_BASE_URL}/bins`,
      binData,
      {
        headers: {
          Authorization: `Bearer ${this.testUser.token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.success && response.data.data) {
      logger.info(`✅ Bin created successfully: ${response.data.data.binId}`);
      logger.info(`   - ID: ${response.data.data._id}`);
      logger.info(`   - Type: ${response.data.data.binType}`);
      logger.info(`   - Capacity: ${response.data.data.capacity}L`);
      logger.info(`   - Fill Level: ${response.data.data.currentLevel}%`);
      logger.info(`   - Location: ${response.data.data.location?.address || "N/A"}`);
      return response.data.data;
    } else {
      throw new Error("Failed to create bin: Invalid response");
    }
  }

  private async verifyBinInDatabase(binId: string): Promise<void> {
    const bin = await Bin.findById(binId).lean();

    if (!bin) {
      throw new Error("Bin not found in database");
    }

    logger.info("✅ Bin found in database:");
    logger.info(`   - Bin ID: ${bin.binId}`);
    logger.info(`   - Status: ${bin.status}`);
    logger.info(`   - Current Level: ${bin.currentLevel}%`);
    logger.info(`   - Capacity: ${bin.capacity}L`);
    logger.info(`   - Location: ${JSON.stringify(bin.location)}`);

    // Verify all required fields
    if (!bin.binId) throw new Error("binId is missing");
    if (!bin.binType) throw new Error("binType is missing");
    if (!bin.location) throw new Error("location is missing");
    if (!bin.capacity) throw new Error("capacity is missing");
    if (bin.currentLevel === undefined) throw new Error("currentLevel is missing");

    logger.info("✅ All required fields present");
  }

  private async retrieveBinViaAPI(binId: string): Promise<void> {
    const response = await axios.get(`${API_BASE_URL}/bins/${binId}`, {
      headers: {
        Authorization: `Bearer ${this.testUser.token}`,
      },
    });

    if (response.data.success && response.data.data) {
      logger.info("✅ Bin retrieved successfully via API");
      logger.info(`   - Bin ID: ${response.data.data.binId}`);
      logger.info(`   - Status: ${response.data.data.status}`);
    } else {
      throw new Error("Failed to retrieve bin via API");
    }
  }

  private async verifyBinInList(binId: string): Promise<void> {
    const response = await axios.get(`${API_BASE_URL}/bins`, {
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

      const foundBin = bins.find((bin: any) => bin.binId === binId);

      if (foundBin) {
        logger.info("✅ Bin found in bins list");
        logger.info(`   - Total bins in list: ${bins.length}`);
      } else {
        throw new Error(`Bin ${binId} not found in bins list`);
      }
    } else {
      throw new Error("Failed to retrieve bins list");
    }
  }

  private verifyDataStructure(bin: any): void {
    logger.info("Verifying data structure compatibility...");

    // Check required fields for frontend
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

    // Check location structure
    if (!bin.location.latitude || !bin.location.longitude) {
      throw new Error("Location missing latitude or longitude");
    }

    // Check data types
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

    logger.info("✅ Data structure is compatible with frontend");
  }

  private async cleanup(binId: string): Promise<void> {
    try {
      await Bin.deleteOne({ _id: binId });
      logger.info("✅ Test bin deleted from database");
    } catch (error: any) {
      logger.warn("⚠️  Failed to delete test bin:", error.message);
    }
  }
}

// Run tests
if (require.main === module) {
  const tester = new CreateBinTester();
  tester
    .runTests()
    .then(() => {
      logger.info("\n🎉 All tests completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("\n💥 Tests failed:", error);
      process.exit(1);
    });
}

export { CreateBinTester };
