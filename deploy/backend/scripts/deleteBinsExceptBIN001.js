"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const Bin_1 = require("../models/Bin");
const logger_1 = require("../utils/logger");
async function deleteBinsExceptBIN001() {
    try {
        logger_1.logger.info('Connecting to database...');
        await (0, database_1.connectDatabase)();
        logger_1.logger.info('✅ Connected to database');
        const totalBins = await Bin_1.Bin.countDocuments({});
        logger_1.logger.info(`Total bins in database: ${totalBins}`);
        const bin001 = await Bin_1.Bin.findOne({ binId: 'BIN001' });
        if (!bin001) {
            logger_1.logger.warn('⚠️  BIN001 not found in database!');
            logger_1.logger.warn('   Will delete all bins. BIN001 will not be preserved.');
        }
        else {
            logger_1.logger.info(`✅ BIN001 found: ${bin001.binId}`);
            logger_1.logger.info(`   Location: ${bin001.location.address || 'N/A'}`);
            logger_1.logger.info(`   Status: ${bin001.status}`);
        }
        logger_1.logger.info('Deleting all bins except BIN001...');
        const deleteResult = await Bin_1.Bin.deleteMany({ binId: { $ne: 'BIN001' } });
        logger_1.logger.info(`✅ Deleted ${deleteResult.deletedCount} bin(s)`);
        const remainingBins = await Bin_1.Bin.countDocuments({});
        logger_1.logger.info(`Remaining bins in database: ${remainingBins}`);
        if (remainingBins === 1) {
            const remainingBin = await Bin_1.Bin.findOne({});
            if (remainingBin?.binId === 'BIN001') {
                logger_1.logger.info('✅ Success! Only BIN001 remains in database');
            }
            else {
                logger_1.logger.warn(`⚠️  Unexpected: Remaining bin is ${remainingBin?.binId}, not BIN001`);
            }
        }
        else if (remainingBins === 0) {
            logger_1.logger.warn('⚠️  No bins remaining (BIN001 was not found)');
        }
        else {
            logger_1.logger.warn(`⚠️  Unexpected: ${remainingBins} bins remaining`);
        }
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('❌ Error deleting bins:', error);
        process.exit(1);
    }
}
deleteBinsExceptBIN001();
//# sourceMappingURL=deleteBinsExceptBIN001.js.map