/**
 * Fix Bin Locations Script
 *
 * Updates all bins in the database with valid Colombo area coordinates
 * to ensure no bins are placed in the sea.
 *
 * Usage: npm run fix:bin-locations
 * Or: ts-node -r tsconfig-paths/register src/scripts/fixBinLocations.ts
 */

import mongoose from "mongoose";
import { config } from "@/config/config";
import { Bin } from "@/models/Bin";
import { logger } from "@/utils/logger";

/**
 * Check if coordinates are in the sea (rough check)
 */
function isInSea(lat: number, lng: number): boolean {
  // Colombo coastline is roughly at longitude 79.84
  // Anything west of 79.84 and south of 6.90 is likely in the sea
  if (lng < 79.84 && lat < 6.90) {
    return true;
  }

  // Additional check: very close to coast with low latitude
  if (lng < 79.845 && lat < 6.88) {
    return true;
  }

  return false;
}

/**
 * Fix all bin locations in the database
 */
async function fixBinLocations(): Promise<void> {
  try {
    // Connect to database
    await mongoose.connect(config.database.mongodbUri);
    logger.info("✅ Connected to MongoDB");

    // Get all bins
    const bins = await Bin.find({});
    logger.info(`📦 Found ${bins.length} bins to update`);

    let updated = 0;
    let deleted = 0;
    let skipped = 0;

    for (const bin of bins) {
      const currentLat = bin.location?.latitude;
      const currentLng = bin.location?.longitude;

      // Check if location is in sea or missing
      if (!currentLat || !currentLng || isInSea(currentLat, currentLng)) {
        // Delete bins that are in the sea
        await Bin.deleteOne({ _id: bin._id });
        deleted++;

        logger.info(
          `🗑️  Deleted bin ${bin.binId} (was in sea or invalid: ${currentLat?.toFixed(4) || 'N/A'}, ${currentLng?.toFixed(4) || 'N/A'})`
        );
      } else {
        // Location is valid, but ensure coordinates array exists
        if (!bin.location.coordinates) {
          bin.location.coordinates = [bin.location.longitude, bin.location.latitude];
          await bin.save();
          updated++;
          logger.info(`✅ Added coordinates array to bin ${bin.binId}`);
        } else {
          skipped++;
        }
      }
    }

    logger.info(`\n📊 Summary:`);
    logger.info(`   ✅ Updated: ${updated} bins (added coordinates)`);
    logger.info(`   🗑️  Deleted: ${deleted} bins (were in sea or invalid)`);
    logger.info(`   ⏭️  Skipped: ${skipped} bins (already valid)`);
    logger.info(`\n✅ All bins in the sea have been removed!`);

  } catch (error) {
    logger.error("❌ Error fixing bin locations:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info("✅ Disconnected from MongoDB");
  }
}

// Run the script
if (require.main === module) {
  fixBinLocations()
    .then(() => {
      logger.info("✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("❌ Script failed:", error);
      process.exit(1);
    });
}

export { fixBinLocations };

