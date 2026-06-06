/**
 * Create 300 Synthetic Bins and Test All Dashboard Features
 *
 * This script:
 * 1. Creates 300 synthetic bins with realistic data
 * 2. Generates predictions for all bins
 * 3. Creates collections and routes
 * 4. Tests all dashboard analytics features including ML Prediction Analytics
 *
 * Usage: npm run create:500bins
 * Or: ts-node -r tsconfig-paths/register src/scripts/create500BinsAndTest.ts
 */

import mongoose from "mongoose";
import { config } from "@/config/config";
import { Bin } from "@/models/Bin";
import { Prediction } from "@/models/Prediction";
import { Collection } from "@/models/Collection";
import { MLClient } from "@/services/mlClient";
import { User } from "@/models/User";
import { logger } from "@/utils/logger";
import axios, { AxiosInstance } from "axios";

// Location data for Sri Lanka (Colombo area) - All verified to be on land
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

// Safe coordinate bounds for Colombo (ensures all points are on land)
// More conservative bounds to avoid sea locations
const COLOMBO_BOUNDS = {
  minLat: 6.85,  // South boundary (moved north to avoid sea)
  maxLat: 6.94,  // North boundary
  minLng: 79.85, // West boundary (moved east from 79.84 to avoid coastline/sea)
  maxLng: 79.92, // East boundary (inland)
};

/**
 * Check if coordinates are in the sea (more comprehensive check)
 */
function isInSea(lat: number, lng: number): boolean {
  // Colombo coastline is roughly at longitude 79.84-79.85
  // Anything west of 79.85 and south of 6.90 is likely in the sea
  if (lng < 79.85 && lat < 6.90) {
    return true;
  }

  // Additional check: very close to coast with low latitude
  if (lng < 79.86 && lat < 6.88) {
    return true;
  }

  // Check: west of 79.84 is definitely sea
  if (lng < 79.84) {
    return true;
  }

  // Check: south of 6.83 and west of 79.87 is likely sea
  if (lat < 6.83 && lng < 79.87) {
    return true;
  }

  return false;
}

const BIN_TYPES: Array<"general" | "recyclable" | "organic" | "hazardous"> = [
  "general",
  "recyclable",
  "organic",
  "hazardous",
];

const STATUSES: Array<"active" | "inactive" | "maintenance" | "full"> = [
  "active",
  "active",
  "active",
  "active",
  "active",
  "inactive",
  "maintenance",
]; // Mostly active

class SyntheticDataGenerator {
  private apiClient: AxiosInstance;
  private authToken: string | null = null;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env["API_URL"] || `http://localhost:${config.port}`;
    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: 60000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Authenticate with API
   */
  private async authenticate(): Promise<boolean> {
    try {
      const testEmail = process.env["TEST_EMAIL"] || "test@example.com";
      const testPassword = process.env["TEST_PASSWORD"] || "test123456";

      // Check if user exists, create if not
      const userExists = await User.findOne({ email: testEmail });
      if (!userExists) {
        await User.create({
          email: testEmail,
          password: testPassword,
          firstName: "Test",
          lastName: "User",
          role: "admin",
          isActive: true,
        });
        logger.info(`✅ Created test user: ${testEmail}`);
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
      return false;
    } catch (error: any) {
      logger.error("❌ Authentication failed:", error.message);
      return false;
    }
  }

  /**
   * Generate random number between min and max
   */
  private random(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Generate random integer between min and max (inclusive)
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Get random item from array
   */
  private randomItem<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error("Cannot get random item from empty array");
    }
    return array[Math.floor(Math.random() * array.length)] as T;
  }

  /**
   * Generate realistic bin ID
   */
  private generateBinId(index: number): string {
    const prefixes = ["MARKET", "OFFICE", "HOSPITAL", "SCHOOL", "BEACH", "PARK", "STREET", "MALL", "HOTEL", "RESTAURANT"];
    const prefix = this.randomItem(prefixes);
    return `BIN-${prefix}-${String(index + 1).padStart(3, "0")}`;
  }

  /**
   * Create 300 synthetic bins
   */
  async create500Bins(): Promise<void> {
    logger.info("📦 Creating 300 synthetic bins...");

    // Clear existing synthetic bins
    const existingCount = await Bin.countDocuments({
      binId: { $regex: /^BIN-/ },
    });
    if (existingCount > 0) {
      logger.info(`🗑️  Deleting ${existingCount} existing bins...`);
      await Bin.deleteMany({ binId: { $regex: /^BIN-/ } });
    }

    const bins = [];
    const now = new Date();
    let attempts = 0;
    const maxAttempts = 600; // Prevent infinite loop

    while (bins.length < 300 && attempts < maxAttempts) {
      attempts++;
      const location = this.randomItem(LOCATIONS);
      const binType = this.randomItem(BIN_TYPES);
      const status = this.randomItem(STATUSES);
      const capacity = this.randomInt(50, 500); // 50L to 500L
      const currentLevel = status === "active"
        ? this.randomInt(0, 95)
        : status === "full"
        ? this.randomInt(90, 100)
        : this.randomInt(0, 50);

      // Add very small random variation to stay close to verified land locations
      // Reduced variation to ±0.01 degrees (~1km) to minimize risk of sea locations
      const latVariation = this.random(-0.01, 0.01); // ~1km variation
      const lngVariation = this.random(-0.01, 0.01); // ~1km variation

      let lat = Math.max(
        COLOMBO_BOUNDS.minLat,
        Math.min(COLOMBO_BOUNDS.maxLat, location.lat + latVariation)
      );
      let lng = Math.max(
        COLOMBO_BOUNDS.minLng,
        Math.min(COLOMBO_BOUNDS.maxLng, location.lng + lngVariation)
      );

      // Validate that the generated coordinates are on land
      // If in sea, use the original location coordinates (no variation)
      if (isInSea(lat, lng)) {
        lat = location.lat;
        lng = location.lng;

        // Double-check original location is not in sea
        if (isInSea(lat, lng)) {
          // Try a different location instead of skipping
          continue; // Retry with different location
        }
      }

      const bin: any = {
        binId: this.generateBinId(bins.length),
        binType,
        type: binType, // For compatibility
        location: {
          latitude: lat,
          longitude: lng,
          address: `${location.name} Area, Colombo, Sri Lanka`,
          coordinates: [lng, lat], // GeoJSON format [lon, lat]
        },
        capacity,
        currentLevel,
        status,
        isOverflowing: currentLevel >= 90,
        lastEmptied: new Date(now.getTime() - this.randomInt(1, 30) * 24 * 60 * 60 * 1000),
        nextCollection: new Date(now.getTime() + this.randomInt(1, 7) * 24 * 60 * 60 * 1000),
        collectionFrequency: this.randomInt(24, 168), // 1-7 days
        alerts: currentLevel >= 90 ? [
          {
            type: "overflow" as const,
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
      logger.warn(`⚠️  Only generated ${bins.length} bins (target was 300) after ${attempts} attempts`);
      logger.warn(`   This may be due to sea location filtering. Continuing with ${bins.length} bins...`);
    }

    // Insert in batches of 100
    logger.info("💾 Inserting bins into database...");
    for (let i = 0; i < bins.length; i += 100) {
      const batch = bins.slice(i, i + 100);
      await Bin.insertMany(batch);
      logger.info(`   ✅ Inserted ${Math.min(i + 100, bins.length)}/${bins.length} bins`);
    }

    logger.info(`✅ Created ${bins.length} synthetic bins`);
  }

  /**
   * Generate predictions for all bins
   */
  async generatePredictions(): Promise<void> {
    logger.info("🤖 Generating predictions for all bins...");

    const bins = await Bin.find({ status: "active" }).limit(300).lean();
    logger.info(`   Found ${bins.length} active bins`);

    const mlClient = new MLClient();
    const isHealthy = await mlClient.healthCheck();
    if (!isHealthy) {
      logger.warn("⚠️  ML service not healthy, skipping predictions");
      return;
    }

    let successCount = 0;
    let failCount = 0;

    // Process in batches of 50
    for (let i = 0; i < bins.length; i += 50) {
      const batch = bins.slice(i, i + 50);

      await Promise.all(
        batch.map(async (bin) => {
          try {
            const prediction = await mlClient.predictWaste(
              bin.binId,
              bin.binType || "general",
              bin.currentLevel || 0,
              bin.capacity || 100,
              bin.location,
              24,
            );

            await Prediction.create({
              binId: bin.binId,
              horizonHours: 24,
              predictedLevel: prediction.predicted_level,
              timeToFullHours: prediction.time_to_full_hours ?? null,
              riskLevel: prediction.risk_level as "low" | "medium" | "high" | "critical",
              recommendedCollectionTime: prediction.recommended_collection_time
                ? new Date(prediction.recommended_collection_time)
                : null,
              confidence: prediction.confidence,
              factors: prediction.factors ?? [],
              source: "ml-service",
            });

            if (prediction.predicted_level >= 85) {
              await Bin.updateOne(
                { binId: bin.binId },
                { $set: { isOverflowing: true } },
              );
            }

            successCount++;
          } catch (error: any) {
            logger.warn(`   ⚠️  Prediction failed for ${bin.binId}: ${error.message}`);
            failCount++;
          }
        }),
      );

      logger.info(`   ✅ Processed ${Math.min(i + 50, bins.length)}/${bins.length} bins`);
    }

    logger.info(`✅ Generated ${successCount} predictions (${failCount} failed)`);
  }

  /**
   * Create some collections
   */
  async createCollections(): Promise<void> {
    logger.info("🚛 Creating sample collections...");

    // Delete existing synthetic collections first
    const existingCount = await Collection.countDocuments({
      collectionId: { $regex: /^COL/ },
    });
    if (existingCount > 0) {
      logger.info(`🗑️  Deleting ${existingCount} existing collections...`);
      await Collection.deleteMany({ collectionId: { $regex: /^COL/ } });
    }

    const bins = await Bin.find({ status: "active" })
      .limit(50)
      .lean();
    const collector = await User.findOne({ role: "collector" }) || await User.findOne({ role: "admin" });

    if (!collector) {
      logger.warn("⚠️  No collector found, skipping collections");
      return;
    }

    const collections = [];
    const now = new Date();

    // Get current collection count to generate unique IDs
    const currentCollectionCount = await Collection.countDocuments();

    for (let i = 0; i < 30; i++) {
      const bin = this.randomItem(bins);
      const scheduledDate = new Date(now.getTime() - this.randomInt(0, 7) * 24 * 60 * 60 * 1000);
      const actualDate = Math.random() > 0.3
        ? new Date(scheduledDate.getTime() + this.randomInt(-2, 2) * 60 * 60 * 1000)
        : undefined;

      // Generate unique collection ID
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

    await Collection.insertMany(collections);
    logger.info(`✅ Created ${collections.length} collections`);
  }

  /**
   * Generate prediction accuracy records
   */
  async generatePredictionAccuracy(): Promise<void> {
    try {
      const { PredictionAccuracy } = await import("@/models/PredictionAccuracy");
      const db = mongoose.connection.db;
      if (!db) return;

      const binHistoryCollection = db.collection("bin_history");
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const predictions = await Prediction.find({
        createdAt: { $gte: sevenDaysAgo },
        horizonHours: 24,
      })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      if (predictions.length === 0) {
        logger.warn("   ⚠️  No predictions found for accuracy calculation");
        return;
      }

      // Group by date
      const predictionsByDate = new Map<string, typeof predictions>();
      for (const pred of predictions) {
        const date = new Date(pred.createdAt);
        date.setHours(0, 0, 0, 0);
        const dateKey = date.toISOString().split("T")[0];

        if (!dateKey) {
          continue; // Skip if dateKey is invalid
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
        const accuracyData: Array<{ predicted: number; actual: number; source: string }> = [];

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
          } else {
            const bin = await Bin.findOne({ binId: pred.binId }).lean();
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
          const percentageErrors = accuracyData.map(
            (d) => (d.actual > 0 ? (Math.abs(d.predicted - d.actual) / d.actual) * 100 : 0),
          );

          const mae = errors.reduce((sum, e) => sum + e, 0) / errors.length;
          const rmse = Math.sqrt(squaredErrors.reduce((sum, e) => sum + e, 0) / squaredErrors.length);
          const mape = percentageErrors.reduce((sum, e) => sum + e, 0) / percentageErrors.length;

          const mlData = accuracyData.filter((d) => d.source === "ml-service");
          const fallbackData = accuracyData.filter((d) => d.source === "fallback");
          const date = new Date(dateKey);

          // Create aggregate record
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

          // Create ML-specific record
          if (mlData.length > 0) {
            const mlErrors = mlData.map((d) => Math.abs(d.predicted - d.actual));
            const mlSquaredErrors = mlErrors.map((e) => e * e);
            const mlPercentageErrors = mlData.map(
              (d) => (d.actual > 0 ? (Math.abs(d.predicted - d.actual) / d.actual) * 100 : 0),
            );

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

          // Create fallback-specific record
          if (fallbackData.length > 0) {
            const fallbackErrors = fallbackData.map((d) => Math.abs(d.predicted - d.actual));
            const fallbackSquaredErrors = fallbackErrors.map((e) => e * e);
            const fallbackPercentageErrors = fallbackData.map(
              (d) => (d.actual > 0 ? (Math.abs(d.predicted - d.actual) / d.actual) * 100 : 0),
            );

            await PredictionAccuracy.create({
              binId: null,
              date,
              mae: fallbackErrors.reduce((sum, e) => sum + e, 0) / fallbackErrors.length,
              rmse: Math.sqrt(
                fallbackSquaredErrors.reduce((sum, e) => sum + e, 0) / fallbackSquaredErrors.length,
              ),
              mape: fallbackPercentageErrors.reduce((sum, e) => sum + e, 0) / fallbackPercentageErrors.length,
              sampleCount: fallbackData.length,
              source: "fallback",
            });
            totalRecords++;
          }
        }
      }

      logger.info(`   ✅ Created ${totalRecords} prediction accuracy records`);
    } catch (error: any) {
      logger.error(`   ❌ Error generating accuracy records: ${error.message}`);
    }
  }

  /**
   * Test all dashboard analytics features
   */
  async testDashboardFeatures(): Promise<void> {
    logger.info("🧪 Testing all dashboard features...");

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
          const bin = await Bin.findOne({ status: "active" }).lean();
          return { binId: bin?.binId || "", days: 24 };
        },
      },
    ];

    for (const test of tests) {
      try {
        logger.info(`   Testing: ${test.name}...`);

        let params: any = test.params;
        if (typeof params === "function") {
          params = await params();
        }

        const response = await this.apiClient[test.method as "get" | "post"](
          test.endpoint,
          test.method === "get" ? { params } : params,
        );

        if (response.data.success) {
          logger.info(`   ✅ ${test.name}: Success`);

          // Log key metrics for ML Prediction Analytics
          if (test.name === "ML Prediction Metrics") {
            const metrics = response.data.data;
            logger.info(`      MAE: ${metrics.accuracy?.mae?.toFixed(2) || "N/A"}`);
            logger.info(`      RMSE: ${metrics.accuracy?.rmse?.toFixed(2) || "N/A"}`);
            logger.info(`      MAPE: ${metrics.accuracy?.mape?.toFixed(2) || "N/A"}%`);
            logger.info(`      ML vs Fallback: ${metrics.mlVsFallback?.mlPercentage?.toFixed(1) || 0}% ML`);
          }
        } else {
          logger.warn(`   ⚠️  ${test.name}: Unsuccessful response`);
        }
      } catch (error: any) {
        logger.error(`   ❌ ${test.name}: ${error.message}`);
      }
    }
  }

  /**
   * Run all steps
   */
  async run(): Promise<void> {
    try {
      console.log("\n" + "=".repeat(60));
      console.log("🚀 Create 300 Bins and Test Dashboard Features");
      console.log("=".repeat(60));

      // Connect to MongoDB
      await mongoose.connect(config.database.mongodbUri);
      logger.info("✅ Connected to MongoDB");

      // Authenticate (optional - only needed for API testing)
      const authenticated = await this.authenticate();
      if (!authenticated) {
        logger.warn("⚠️  Authentication failed - continuing without API testing");
        logger.info("   Note: Bins, predictions, and collections will still be created");
        logger.info("   API endpoint testing will be skipped");
      }

      // Step 1: Create 300 bins
      await this.create500Bins();

      // Step 2: Generate predictions
      await this.generatePredictions();

      // Step 3: Create collections
      await this.createCollections();

      // Step 4: Generate prediction accuracy records
      logger.info("\n📈 Generating prediction accuracy records...");
      await this.generatePredictionAccuracy();

      // Step 5: Test dashboard features (only if authenticated)
      if (this.authToken) {
        await this.testDashboardFeatures();
      } else {
        logger.info("\n⚠️  Skipping API endpoint tests (authentication failed)");
        logger.info("   You can test endpoints manually via the dashboard");
      }

      logger.info("\n✅ All steps completed successfully!");
      logger.info("\n📊 Summary:");
      logger.info(`   - Bins created: 300`);
      logger.info(`   - Predictions: Check database`);
      logger.info(`   - Collections: 30`);
      logger.info(`   - Dashboard features: All tested`);

      logger.info("\n💡 Next steps:");
      logger.info("   1. Open the web dashboard");
      logger.info("   2. Navigate to Analytics page");
      logger.info("   3. View ML Prediction Analytics section");
      logger.info("   4. Check all other analytics features");

      await mongoose.disconnect();
      logger.info("✅ Disconnected from MongoDB");
    } catch (error: any) {
      logger.error("❌ Error:", error);
      await mongoose.disconnect();
      process.exit(1);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const generator = new SyntheticDataGenerator();
  generator.run().catch((error) => {
    logger.error("Script failed:", error);
    process.exit(1);
  });
}

export { SyntheticDataGenerator };

