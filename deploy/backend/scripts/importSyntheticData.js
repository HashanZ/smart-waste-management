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
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_1 = require("csv-parse/sync");
async function importSyntheticData() {
    try {
        logger_1.logger.info("Starting synthetic data import...");
        await mongoose_1.default.connect(config_1.config.database.mongodbUri, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 30000,
            retryWrites: true,
            retryReads: true,
        });
        logger_1.logger.info("✅ Connected to MongoDB");
        const csvPath = path.join(__dirname, "../../../ml-service/data/synthetic_waste_data.csv");
        if (!fs.existsSync(csvPath)) {
            logger_1.logger.error(`❌ CSV file not found at: ${csvPath}`);
            logger_1.logger.info("💡 Please run: cd ml-service && python scripts/generate_synthetic_data.py --num_bins=1 --num_days=30");
            await mongoose_1.default.disconnect();
            process.exit(1);
        }
        logger_1.logger.info(`📄 Reading CSV file: ${csvPath}`);
        const csvContent = fs.readFileSync(csvPath, "utf-8");
        const records = (0, sync_1.parse)(csvContent, {
            columns: true,
            skip_empty_lines: true,
            cast: true,
        });
        logger_1.logger.info(`📊 Found ${records.length} records in CSV`);
        if (records.length === 0) {
            logger_1.logger.error("❌ No records found in CSV file");
            await mongoose_1.default.disconnect();
            process.exit(1);
        }
        const db = mongoose_1.default.connection.db;
        if (!db) {
            logger_1.logger.error("❌ Database connection not available");
            await mongoose_1.default.disconnect();
            process.exit(1);
        }
        const collection = db.collection("bin_history");
        const existingCount = await collection.countDocuments({
            binId: { $regex: /^BIN-/ },
        });
        if (existingCount > 0) {
            logger_1.logger.warn(`⚠️ Found ${existingCount} existing records. Deleting old synthetic data...`);
            await collection.deleteMany({
                binId: { $regex: /^BIN-/ },
            });
            logger_1.logger.info("✅ Deleted old synthetic data");
        }
        logger_1.logger.info("🔄 Transforming and inserting data...");
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
                actualFillLevel24h: record.fill_level_24h_later,
            };
        });
        const batchSize = 1000;
        let inserted = 0;
        for (let i = 0; i < transformedData.length; i += batchSize) {
            const batch = transformedData.slice(i, i + batchSize);
            await collection.insertMany(batch);
            inserted += batch.length;
            logger_1.logger.info(`  Inserted ${inserted}/${transformedData.length} records...`);
        }
        logger_1.logger.info(`✅ Successfully imported ${inserted} records`);
        const totalCount = await collection.countDocuments({
            actualFillLevel24h: { $exists: true },
        });
        logger_1.logger.info(`📊 Total records with labels: ${totalCount}`);
        const sample = await collection
            .findOne({ actualFillLevel24h: { $exists: true } }, { sort: { timestamp: -1 } });
        if (sample) {
            logger_1.logger.info("📋 Sample record:", {
                binId: sample['binId'],
                timestamp: sample['timestamp'],
                fillLevel: sample['fillLevel'],
                actualFillLevel24h: sample['actualFillLevel24h'],
            });
        }
        await mongoose_1.default.disconnect();
        logger_1.logger.info("✅ Disconnected from MongoDB");
        logger_1.logger.info("🎉 Synthetic data import complete!");
        logger_1.logger.info("💡 You can now run: npm run train:ml");
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error("❌ Import error");
        if (error instanceof Error) {
            logger_1.logger.error(`Error message: ${error.message}`);
            logger_1.logger.error(`Error stack: ${error.stack}`);
        }
        else {
            logger_1.logger.error(`Error: ${JSON.stringify(error)}`);
        }
        await mongoose_1.default.disconnect().catch(() => { });
        process.exit(1);
    }
}
importSyntheticData();
//# sourceMappingURL=importSyntheticData.js.map