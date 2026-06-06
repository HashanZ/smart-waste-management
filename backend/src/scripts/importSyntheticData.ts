import mongoose from "mongoose";
import { config } from "@/config/config";
import { logger } from "@/utils/logger";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";

interface SyntheticDataRow {
  bin_id: string;
  timestamp: string;
  fill_level: number;
  bin_type: string;
  latitude: number;
  longitude: number;
  hour: number;
  day_of_week: number;
  fill_level_24h_later: number;
}

async function importSyntheticData() {
  try {
    logger.info("Starting synthetic data import...");

    // Connect to database with extended timeout options (fixes DNS issues)
    await mongoose.connect(config.database.mongodbUri, {
      serverSelectionTimeoutMS: 30000, // Increased from default for DNS resolution
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      retryWrites: true,
      retryReads: true,
    });
    logger.info("✅ Connected to MongoDB");

    // Find CSV file
    const csvPath = path.join(
      __dirname,
      "../../../ml-service/data/synthetic_waste_data.csv"
    );

    if (!fs.existsSync(csvPath)) {
      logger.error(`❌ CSV file not found at: ${csvPath}`);
      logger.info(
        "💡 Please run: cd ml-service && python scripts/generate_synthetic_data.py --num_bins=1 --num_days=30"
      );
      await mongoose.disconnect();
      process.exit(1);
    }

    logger.info(`📄 Reading CSV file: ${csvPath}`);

    // Read and parse CSV
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const records: SyntheticDataRow[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      cast: true,
    }) as SyntheticDataRow[];

    logger.info(`📊 Found ${records.length} records in CSV`);

    if (records.length === 0) {
      logger.error("❌ No records found in CSV file");
      await mongoose.disconnect();
      process.exit(1);
    }

    // Get MongoDB collection
    const db = mongoose.connection.db;
    if (!db) {
      logger.error("❌ Database connection not available");
      await mongoose.disconnect();
      process.exit(1);
    }

    const collection = db.collection("bin_history");

    // Check if data already exists
    const existingCount = await collection.countDocuments({
      binId: { $regex: /^BIN-/ },
    });

    if (existingCount > 0) {
      logger.warn(
        `⚠️ Found ${existingCount} existing records. Deleting old synthetic data...`
      );
      await collection.deleteMany({
        binId: { $regex: /^BIN-/ },
      });
      logger.info("✅ Deleted old synthetic data");
    }

    // Transform and insert data
    logger.info("🔄 Transforming and inserting data...");
    const transformedData = records.map((record) => {
      const timestamp = new Date(record.timestamp);

      return {
        binId: record.bin_id,
        timestamp: timestamp,
        fillLevel: record.fill_level,
        binType: record.bin_type,
        location: {
          latitude: record.latitude,
          longitude: record.longitude,
        },
        dayOfWeek: record.day_of_week,
        hourOfDay: record.hour,
        wasCollected: false,
        actualFillLevel24h: record.fill_level_24h_later, // This is the key field for training
      };
    });

    // Insert in batches for better performance
    const batchSize = 1000;
    let inserted = 0;

    for (let i = 0; i < transformedData.length; i += batchSize) {
      const batch = transformedData.slice(i, i + batchSize);
      await collection.insertMany(batch);
      inserted += batch.length;
      logger.info(`  Inserted ${inserted}/${transformedData.length} records...`);
    }

    logger.info(`✅ Successfully imported ${inserted} records`);

    // Verify import
    const totalCount = await collection.countDocuments({
      actualFillLevel24h: { $exists: true },
    });
    logger.info(`📊 Total records with labels: ${totalCount}`);

    // Show sample data
    const sample = await collection
      .findOne(
        { actualFillLevel24h: { $exists: true } },
        { sort: { timestamp: -1 } }
      );

    if (sample) {
      logger.info("📋 Sample record:", {
        binId: sample['binId'],
        timestamp: sample['timestamp'],
        fillLevel: sample['fillLevel'],
        actualFillLevel24h: sample['actualFillLevel24h'],
      });
    }

    await mongoose.disconnect();
    logger.info("✅ Disconnected from MongoDB");
    logger.info("🎉 Synthetic data import complete!");
    logger.info("💡 You can now run: npm run train:ml");

    process.exit(0);
  } catch (error) {
    logger.error("❌ Import error");
    if (error instanceof Error) {
      logger.error(`Error message: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
    } else {
      logger.error(`Error: ${JSON.stringify(error)}`);
    }
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Run import
importSyntheticData();

