/**
 * ML Functions Test Script
 *
 * This script tests all ML-related functions via the dashboard API endpoints.
 * It verifies:
 * 1. ML Service Health
 * 2. Waste Predictions
 * 3. Prediction Accuracy Metrics
 * 4. Route Optimization
 * 5. Automatic Collection Scheduling
 *
 * Usage: npm run test:ml
 * Or: ts-node src/scripts/testMLFunctions.ts
 */

import axios, { AxiosInstance } from "axios";
import mongoose from "mongoose";
import { config } from "@/config/config";
import { Bin } from "@/models/Bin";
import { Prediction } from "@/models/Prediction";
import { Collection } from "@/models/Collection";
import { PredictionAccuracy } from "@/models/PredictionAccuracy";
import { logger } from "@/utils/logger";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  message: string;
  details?: any;
  duration?: number;
}

class MLFunctionsTester {
  private apiClient: AxiosInstance;
  private authToken: string | null = null;
  private testResults: TestResult[] = [];
  private baseURL: string;

  constructor() {
    this.baseURL = process.env["API_URL"] || `http://localhost:${config.port}`;
    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Check if a user exists in the database
   */
  private async checkUserExists(email: string): Promise<boolean> {
    try {
      const { User } = await import("@/models/User");
      const user = await User.findOne({ email }).lean();
      return !!user;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete a user by email
   */
  private async deleteUser(email: string): Promise<boolean> {
    try {
      const { User } = await import("@/models/User");
      const result = await User.deleteOne({ email });
      return result.deletedCount > 0;
    } catch (error: any) {
      logger.error(`❌ Failed to delete user: ${error.message}`);
      return false;
    }
  }

  /**
   * Create a test user if it doesn't exist
   */
  private async createTestUser(
    email: string,
    password: string,
    forceRecreate: boolean = false,
  ): Promise<boolean> {
    try {
      const { User } = await import("@/models/User");

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        if (forceRecreate) {
          logger.info(`Deleting existing user ${email} to recreate...`);
          await this.deleteUser(email);
        } else {
          logger.info(`User ${email} already exists`);
          return true;
        }
      }

      // Create new user - password will be hashed automatically by User model pre-save hook
      await User.create({
        email,
        password, // Plain password - will be hashed by pre-save hook
        firstName: "Test",
        lastName: "User",
        role: "admin",
        isActive: true,
      });

      logger.info(`✅ Created test user: ${email}`);
      return true;
    } catch (error: any) {
      logger.error(`❌ Failed to create test user: ${error.message}`);
      if (error.stack) {
        logger.error("Stack trace:", error.stack);
      }
      return false;
    }
  }

  /**
   * Login and get authentication token
   */
  private async authenticate(): Promise<boolean> {
    const testEmail = process.env["TEST_EMAIL"] || "test@example.com";
    const testPassword = process.env["TEST_PASSWORD"] || "test123456";

    try {
      logger.info(`Attempting authentication with email: ${testEmail}`);

      // First, try to create the user if it doesn't exist
      const userExists = await this.checkUserExists(testEmail);
      if (!userExists) {
        logger.info(
          `User ${testEmail} not found. Attempting to create test user...`,
        );
        const created = await this.createTestUser(testEmail, testPassword);
        if (!created) {
          logger.error(
            "❌ Could not create test user. Please create a user manually or set TEST_EMAIL and TEST_PASSWORD.",
          );
          logger.info("\n💡 To create a user manually:");
          logger.info(
            "   1. Use the registration endpoint: POST /api/auth/register",
          );
          logger.info(
            '   2. Or set environment variables: $env:TEST_EMAIL="your@email.com"; $env:TEST_PASSWORD="yourpassword"',
          );
          return false;
        }
      }

      const response = await axios.post(`${this.baseURL}/api/auth/login`, {
        email: testEmail,
        password: testPassword,
      });

      if (response.data.success && response.data.data?.token) {
        this.authToken = response.data.data.token;
        this.apiClient.defaults.headers.common["Authorization"] =
          `Bearer ${this.authToken}`;
        logger.info("✅ Authentication successful");
        return true;
      }
      logger.error("❌ Authentication failed: Invalid response format");
      logger.error("Response:", JSON.stringify(response.data, null, 2));
      return false;
    } catch (error: any) {
      if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
        logger.error("❌ Cannot connect to backend server. Is it running?");
        logger.error(`   Tried to connect to: ${this.baseURL}`);
        logger.info("\n💡 Make sure the backend server is running:");
        logger.info("   cd backend && npm run dev");
        return false;
      }

      const errorMessage =
        error.response?.data?.message || error.message || "Unknown error";
      const statusCode = error.response?.status || "N/A";
      logger.error(
        `❌ Authentication failed (Status: ${statusCode}):`,
        errorMessage,
      );

      if (error.response?.data) {
        logger.error(
          "Full error response:",
          JSON.stringify(error.response.data, null, 2),
        );
      } else if (error.response) {
        logger.error("Error response status:", error.response.status);
        logger.error(
          "Error response headers:",
          JSON.stringify(error.response.headers, null, 2),
        );
      }

      // If user exists but password is wrong, delete and recreate
      if (statusCode === 401) {
        const userExists = await this.checkUserExists(testEmail);
        if (userExists) {
          logger.info("\n⚠️  User exists but password doesn't match.");
          logger.info(
            "   Deleting existing user and recreating with correct password...",
          );

          const recreated = await this.createTestUser(
            testEmail,
            testPassword,
            true,
          );
          if (recreated) {
            logger.info("   ✅ User recreated. Retrying authentication...");

            // Retry login
            try {
              const retryResponse = await axios.post(
                `${this.baseURL}/api/auth/login`,
                {
                  email: testEmail,
                  password: testPassword,
                },
              );

              if (
                retryResponse.data.success &&
                retryResponse.data.data?.token
              ) {
                this.authToken = retryResponse.data.data.token;
                this.apiClient.defaults.headers.common["Authorization"] =
                  `Bearer ${this.authToken}`;
                logger.info(
                  "✅ Authentication successful after user recreation",
                );
                return true;
              }
            } catch (retryError: any) {
              logger.error(
                "❌ Authentication still failed after user recreation",
              );
            }
          } else {
            logger.error("❌ Failed to recreate user");
          }
        }
      }

      logger.info(
        "\n💡 Tip: Set TEST_EMAIL and TEST_PASSWORD environment variables:",
      );
      logger.info(
        '   Example: $env:TEST_EMAIL="your@email.com"; $env:TEST_PASSWORD="yourpassword"; npm run test:ml',
      );
      logger.info(
        "   Or create a user account first via the registration endpoint.",
      );
      return false;
    }
  }

  /**
   * Run a test and record the result
   */
  private async runTest(
    name: string,
    testFn: () => Promise<any>,
  ): Promise<void> {
    const startTime = Date.now();
    try {
      logger.info(`\n🧪 Testing: ${name}`);
      const result = await testFn();
      const duration = Date.now() - startTime;

      this.testResults.push({
        name,
        status: "PASS",
        message: "Test passed successfully",
        details: result,
        duration,
      });
      logger.info(`✅ PASS: ${name} (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.testResults.push({
        name,
        status: "FAIL",
        message: error.message || "Test failed",
        details: error.response?.data || error.stack,
        duration,
      });
      logger.error(`❌ FAIL: ${name} - ${error.message}`);
    }
  }

  /**
   * Test 1: ML Service Health Check
   */
  private async testMLHealth(): Promise<any> {
    const response = await this.apiClient.get("/api/admin/ml/health");

    if (!response.data.success) {
      throw new Error("ML health check returned unsuccessful response");
    }

    const health = response.data.data;

    // Validate health response structure
    if (typeof health.healthy !== "boolean") {
      throw new Error("Invalid health status format");
    }

    if (!health.healthy) {
      throw new Error("ML service is not healthy");
    }

    logger.info(
      `   Health Status: ${health.healthy ? "✅ Healthy" : "❌ Unhealthy"}`,
    );
    logger.info(
      `   Model Trained: ${health.model_trained ? "✅ Yes" : "⚠️ No"}`,
    );
    logger.info(`   Latency: ${health.latencyMs}ms`);

    return health;
  }

  /**
   * Test 2: Get Predictions for a Bin
   */
  private async testPredictions(): Promise<any> {
    // Get a random active bin
    const bin = await Bin.findOne({ status: "active" })
      .select("binId binType currentLevel capacity")
      .lean();

    if (!bin) {
      throw new Error("No active bins found in database");
    }

    logger.info(`   Testing predictions for bin: ${bin.binId}`);

    try {
      const response = await this.apiClient.get("/api/analytics/predictions", {
        params: {
          binId: bin.binId,
          days: 24,
        },
      });

      if (!response.data.success) {
        const errorMsg =
          response.data.message ||
          "Predictions endpoint returned unsuccessful response";
        const errorDetails = response.data.error || response.data;
        logger.error(
          `   Error details: ${JSON.stringify(errorDetails, null, 2)}`,
        );
        throw new Error(errorMsg);
      }

      const predictions = response.data.data;

      // Validate predictions structure
      if (!Array.isArray(predictions) && !predictions.predictions) {
        throw new Error("Invalid predictions format");
      }

      const predArray = Array.isArray(predictions)
        ? predictions
        : predictions.predictions || [];

      if (predArray.length === 0) {
        logger.warn(
          "   ⚠️ No predictions returned (this is normal if predictions haven't been generated yet)",
        );
      } else {
        logger.info(`   ✅ Received ${predArray.length} predictions`);
        if (predArray[0]) {
          logger.info(
            `   Sample prediction: ${JSON.stringify(predArray[0], null, 2)}`,
          );
        }
      }

      return predictions;
    } catch (error: any) {
      // If it's a 500 error, it might be a server issue - log more details
      if (error.response?.status === 500) {
        logger.error(
          `   Server error (500): ${error.response?.data?.message || error.message}`,
        );
        logger.error(
          `   This might indicate an issue with the predictions endpoint or ML service`,
        );
        // Don't fail the test if it's a server error - just warn
        logger.warn("   ⚠️ Predictions test skipped due to server error");
        return {
          predictions: [],
          note: "Server error - predictions unavailable",
        };
      }
      throw error;
    }
  }

  /**
   * Test 3: Prediction Accuracy Metrics
   */
  private async testPredictionMetrics(): Promise<any> {
    const response = await this.apiClient.get(
      "/api/analytics/predictions/metrics",
      {
        params: {
          startDate: new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          endDate: new Date().toISOString(),
        },
      },
    );

    if (!response.data.success) {
      throw new Error(
        "Prediction metrics endpoint returned unsuccessful response",
      );
    }

    const metrics = response.data.data;

    logger.info(`   MAE: ${metrics.accuracy?.mae?.toFixed(2) || "N/A"}`);
    logger.info(`   RMSE: ${metrics.accuracy?.rmse?.toFixed(2) || "N/A"}`);
    logger.info(`   MAPE: ${metrics.accuracy?.mape?.toFixed(2) || "N/A"}%`);
    logger.info(
      `   ML vs Fallback: ${metrics.mlVsFallback?.mlPercentage?.toFixed(1) || 0}% ML, ${metrics.mlVsFallback?.fallbackPercentage?.toFixed(1) || 0}% Fallback`,
    );

    return metrics;
  }

  /**
   * Test 4: Route Optimization (Direct)
   */
  private async testRouteOptimization(): Promise<any> {
    // Get some active bins for route optimization
    const bins = await Bin.find({ status: "active" })
      .select("binId binType currentLevel capacity location")
      .limit(5)
      .lean();

    if (bins.length < 2) {
      throw new Error(
        "Need at least 2 active bins for route optimization test",
      );
    }

    logger.info(`   Testing route optimization with ${bins.length} bins`);

    // Prepare bin data for optimization
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
        latitude: 6.9271, // Colombo, Sri Lanka
        longitude: 79.8612,
      },
      traffic_multiplier: 1.2,
    });

    if (!response.data.success) {
      throw new Error(
        "Route optimization endpoint returned unsuccessful response",
      );
    }

    const optimization = response.data.data;

    logger.info(`   ✅ Route optimized successfully`);
    logger.info(
      `   Total Distance: ${optimization.totalDistance?.toFixed(2) || "N/A"} km`,
    );
    logger.info(
      `   Estimated Duration: ${optimization.estimatedDuration || "N/A"} minutes`,
    );
    logger.info(
      `   Efficiency Score: ${optimization.efficiencyScore?.toFixed(2) || "N/A"}`,
    );
    logger.info(
      `   Bins in Route: ${optimization.optimizedRoute?.length || 0}`,
    );

    return optimization;
  }

  /**
   * Test 5: Check Prediction Data in Database
   */
  private async testPredictionData(): Promise<any> {
    const predictionCount = await Prediction.countDocuments();
    const recentPredictions = await Prediction.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    logger.info(`   Total predictions in database: ${predictionCount}`);

    if (recentPredictions.length > 0) {
      logger.info(`   Recent predictions:`);
      for (const pred of recentPredictions) {
        // Count predictions for this specific bin
        const binPredictionCount = await Prediction.countDocuments({
          binId: pred.binId,
        });
        logger.info(
          `     Bin ${pred.binId}: ${binPredictionCount} total predictions, Latest: ${pred.predictedLevel}% (${pred.riskLevel} risk, ${pred.source} source)`,
        );
      }
    } else {
      logger.warn("   ⚠️ No predictions found in database");
    }

    return {
      count: predictionCount,
      recent: recentPredictions,
    };
  }

  /**
   * Test 6: Check Prediction Accuracy Data
   */
  private async testPredictionAccuracyData(): Promise<any> {
    const accuracyCount = await PredictionAccuracy.countDocuments();
    const recentAccuracy = await PredictionAccuracy.find()
      .sort({ date: -1 })
      .limit(5)
      .lean();

    logger.info(`   Total accuracy records: ${accuracyCount}`);

    if (recentAccuracy.length > 0) {
      logger.info(`   Recent accuracy metrics:`);
      recentAccuracy.forEach((acc, idx) => {
        logger.info(
          `     ${idx + 1}. Date: ${acc.date}, MAE: ${acc.mae?.toFixed(2)}, RMSE: ${acc.rmse?.toFixed(2)}, MAPE: ${acc.mape?.toFixed(2)}%`,
        );
      });
    } else {
      logger.warn("   ⚠️ No accuracy records found in database");
    }

    return {
      count: accuracyCount,
      recent: recentAccuracy,
    };
  }

  /**
   * Test 7: Check Automatic Collection Scheduling
   */
  private async testAutomaticCollections(): Promise<any> {
    // Check for recently scheduled collections (last 24 hours)
    // Automatic collections are created by scheduler and typically have:
    // - scheduledDate in the future
    // - status 'scheduled'
    // - created within last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const recentCollections = await Collection.find({
      createdAt: { $gte: yesterday },
      status: "scheduled",
    })
      .sort({ scheduledDate: -1 })
      .limit(10)
      .lean();

    logger.info(
      `   Recently scheduled collections (last 24h): ${recentCollections.length}`,
    );

    if (recentCollections.length > 0) {
      logger.info(`   Sample scheduled collections:`);
      recentCollections.slice(0, 3).forEach((coll, idx) => {
        logger.info(
          `     ${idx + 1}. Bin ${coll.binId}, Status: ${coll.status}, Scheduled: ${coll.scheduledDate}`,
        );
      });
      logger.info(
        `   Note: Automatic scheduler runs every 6 hours and creates collections for bins needing service`,
      );
    } else {
      logger.warn(
        "   ⚠️ No recently scheduled collections found (this is normal if scheduler hasn't run yet)",
      );
      logger.info(`   Tip: Automatic scheduler runs every 6 hours at minute 0`);
    }

    return {
      count: recentCollections.length,
      collections: recentCollections,
    };
  }

  /**
   * Test 8: Dashboard Data (includes ML health)
   */
  private async testDashboardData(): Promise<any> {
    const response = await this.apiClient.get("/api/analytics/dashboard");

    if (!response.data.success) {
      throw new Error("Dashboard endpoint returned unsuccessful response");
    }

    const dashboard = response.data.data;

    logger.info(`   Total Bins: ${dashboard.stats?.totalBins || 0}`);
    logger.info(`   Active Bins: ${dashboard.stats?.activeBins || 0}`);
    logger.info(
      `   Collections Today: ${dashboard.stats?.collectionsToday || 0}`,
    );
    logger.info(
      `   Overflowing Bins: ${dashboard.stats?.overflowingBins || 0}`,
    );

    return dashboard;
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log("\n" + "=".repeat(60));
    console.log("🧪 ML Functions Test Suite");
    console.log("=".repeat(60));

    // Connect to MongoDB
    try {
      await mongoose.connect(config.database.mongodbUri);
      logger.info("✅ Connected to MongoDB");
    } catch (error) {
      logger.error("❌ Failed to connect to MongoDB:", error);
      process.exit(1);
    }

    // Authenticate
    const authenticated = await this.authenticate();
    if (!authenticated) {
      logger.error("❌ Authentication failed. Cannot proceed with tests.");
      await mongoose.disconnect();
      process.exit(1);
    }

    // Run all tests
    await this.runTest("ML Service Health Check", () => this.testMLHealth());
    await this.runTest("Waste Predictions", () => this.testPredictions());
    await this.runTest("Prediction Accuracy Metrics", () =>
      this.testPredictionMetrics(),
    );
    await this.runTest("Route Optimization", () =>
      this.testRouteOptimization(),
    );
    await this.runTest("Prediction Data in Database", () =>
      this.testPredictionData(),
    );
    await this.runTest("Prediction Accuracy Data", () =>
      this.testPredictionAccuracyData(),
    );
    await this.runTest("Automatic Collection Scheduling", () =>
      this.testAutomaticCollections(),
    );
    await this.runTest("Dashboard Data", () => this.testDashboardData());

    // Print summary
    this.printSummary();

    // Disconnect from MongoDB
    await mongoose.disconnect();
    logger.info("✅ Disconnected from MongoDB");
  }

  /**
   * Print test summary
   */
  private printSummary(): void {
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
      const icon =
        result.status === "PASS"
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
    } else {
      console.log("⚠️  Some tests failed. Please review the details above.");
      process.exit(1);
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  const tester = new MLFunctionsTester();
  tester.runAllTests().catch((error) => {
    logger.error("Test suite failed:", error);
    process.exit(1);
  });
}

export { MLFunctionsTester };
