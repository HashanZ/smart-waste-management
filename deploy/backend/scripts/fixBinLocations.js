"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixBinLocations = fixBinLocations;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../config/config");
const Bin_1 = require("../models/Bin");
const logger_1 = require("../utils/logger");
function isInSea(lat, lng) {
    if (lng < 79.84 && lat < 6.90) {
        return true;
    }
    if (lng < 79.845 && lat < 6.88) {
        return true;
    }
    return false;
}
async function fixBinLocations() {
    try {
        await mongoose_1.default.connect(config_1.config.database.mongodbUri);
        logger_1.logger.info("✅ Connected to MongoDB");
        const bins = await Bin_1.Bin.find({});
        logger_1.logger.info(`📦 Found ${bins.length} bins to update`);
        let updated = 0;
        let deleted = 0;
        let skipped = 0;
        for (const bin of bins) {
            const currentLat = bin.location?.latitude;
            const currentLng = bin.location?.longitude;
            if (!currentLat || !currentLng || isInSea(currentLat, currentLng)) {
                await Bin_1.Bin.deleteOne({ _id: bin._id });
                deleted++;
                logger_1.logger.info(`🗑️  Deleted bin ${bin.binId} (was in sea or invalid: ${currentLat?.toFixed(4) || 'N/A'}, ${currentLng?.toFixed(4) || 'N/A'})`);
            }
            else {
                if (!bin.location.coordinates) {
                    bin.location.coordinates = [bin.location.longitude, bin.location.latitude];
                    await bin.save();
                    updated++;
                    logger_1.logger.info(`✅ Added coordinates array to bin ${bin.binId}`);
                }
                else {
                    skipped++;
                }
            }
        }
        logger_1.logger.info(`\n📊 Summary:`);
        logger_1.logger.info(`   ✅ Updated: ${updated} bins (added coordinates)`);
        logger_1.logger.info(`   🗑️  Deleted: ${deleted} bins (were in sea or invalid)`);
        logger_1.logger.info(`   ⏭️  Skipped: ${skipped} bins (already valid)`);
        logger_1.logger.info(`\n✅ All bins in the sea have been removed!`);
    }
    catch (error) {
        logger_1.logger.error("❌ Error fixing bin locations:", error);
        throw error;
    }
    finally {
        await mongoose_1.default.disconnect();
        logger_1.logger.info("✅ Disconnected from MongoDB");
    }
}
if (require.main === module) {
    fixBinLocations()
        .then(() => {
        logger_1.logger.info("✅ Script completed successfully");
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error("❌ Script failed:", error);
        process.exit(1);
    });
}
//# sourceMappingURL=fixBinLocations.js.map