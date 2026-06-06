"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dataCollector_1 = require("../services/dataCollector");
const response_1 = require("../utils/response");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.get('/stats', auth_1.authenticate, async (_req, res) => {
    try {
        const stats = await dataCollector_1.DataCollector.getStats();
        response_1.ResponseHandler.success(res, stats, 'Data collection statistics retrieved');
    }
    catch (error) {
        logger_1.logger.error('Failed to get data collection stats', { error });
        response_1.ResponseHandler.error(res, 'Failed to get statistics', 500);
    }
});
router.get('/export', auth_1.authenticate, async (req, res) => {
    try {
        const { binId } = req.query;
        const csv = await dataCollector_1.DataCollector.exportTrainingData(binId);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=training_data.csv');
        res.send(csv);
    }
    catch (error) {
        logger_1.logger.error('Failed to export training data', { error });
        response_1.ResponseHandler.error(res, 'Failed to export data', 500);
    }
});
router.post('/collect', auth_1.authenticate, async (_req, res) => {
    try {
        await dataCollector_1.DataCollector.collectBinData();
        response_1.ResponseHandler.success(res, null, 'Data collection triggered successfully');
    }
    catch (error) {
        logger_1.logger.error('Failed to trigger data collection', { error });
        response_1.ResponseHandler.error(res, 'Failed to collect data', 500);
    }
});
exports.default = router;
//# sourceMappingURL=dataCollection.js.map