/**
 * Script to delete all bins from database except BIN001
 *
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/deleteBinsExceptBIN001.ts
 */

import { connectDatabase } from '@/config/database';
import { Bin } from '@/models/Bin';
import { logger } from '@/utils/logger';

async function deleteBinsExceptBIN001(): Promise<void> {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    await connectDatabase();
    logger.info('✅ Connected to database');

    // Count total bins
    const totalBins = await Bin.countDocuments({});
    logger.info(`Total bins in database: ${totalBins}`);

    // Check if BIN001 exists
    const bin001 = await Bin.findOne({ binId: 'BIN001' });
    if (!bin001) {
      logger.warn('⚠️  BIN001 not found in database!');
      logger.warn('   Will delete all bins. BIN001 will not be preserved.');
    } else {
      logger.info(`✅ BIN001 found: ${bin001.binId}`);
      logger.info(`   Location: ${bin001.location.address || 'N/A'}`);
      logger.info(`   Status: ${bin001.status}`);
    }

    // Delete all bins except BIN001
    logger.info('Deleting all bins except BIN001...');
    const deleteResult = await Bin.deleteMany({ binId: { $ne: 'BIN001' } });

    logger.info(`✅ Deleted ${deleteResult.deletedCount} bin(s)`);

    // Verify BIN001 still exists
    const remainingBins = await Bin.countDocuments({});
    logger.info(`Remaining bins in database: ${remainingBins}`);

    if (remainingBins === 1) {
      const remainingBin = await Bin.findOne({});
      if (remainingBin?.binId === 'BIN001') {
        logger.info('✅ Success! Only BIN001 remains in database');
      } else {
        logger.warn(`⚠️  Unexpected: Remaining bin is ${remainingBin?.binId}, not BIN001`);
      }
    } else if (remainingBins === 0) {
      logger.warn('⚠️  No bins remaining (BIN001 was not found)');
    } else {
      logger.warn(`⚠️  Unexpected: ${remainingBins} bins remaining`);
    }

    process.exit(0);
  } catch (error) {
    logger.error('❌ Error deleting bins:', error);
    process.exit(1);
  }
}

// Run the script
deleteBinsExceptBIN001();

