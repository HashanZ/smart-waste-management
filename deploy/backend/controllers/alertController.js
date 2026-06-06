"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertController = void 0;
const response_1 = require("../utils/response");
const logger_1 = require("../utils/logger");
const Bin_1 = require("../models/Bin");
class AlertController {
    static async getAlerts(req, res) {
        try {
            const { status, type, limit = 100 } = req.query;
            const matchStage = {};
            if (status === 'active') {
                matchStage['alerts.resolved'] = false;
            }
            else if (status === 'resolved') {
                matchStage['alerts.resolved'] = true;
            }
            if (type) {
                matchStage['alerts.type'] = type;
            }
            const alertsFromBins = await Bin_1.Bin.aggregate([
                { $unwind: '$alerts' },
                { $match: matchStage },
                {
                    $project: {
                        _id: 0,
                        id: { $toString: '$_id' },
                        alertId: { $concat: ['$binId', '-', { $toString: '$alerts.timestamp' }] },
                        type: '$alerts.type',
                        severity: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ['$alerts.type', 'overflow'] }, then: 'critical' },
                                    { case: { $eq: ['$alerts.type', 'full'] }, then: 'high' },
                                    { case: { $eq: ['$alerts.type', 'maintenance'] }, then: 'medium' },
                                    { case: { $eq: ['$alerts.type', 'offline'] }, then: 'low' }
                                ],
                                default: 'medium'
                            }
                        },
                        title: {
                            $concat: [
                                'Bin ', '$binId', ' - ',
                                {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ['$alerts.type', 'overflow'] }, then: 'Overflowing' },
                                            { case: { $eq: ['$alerts.type', 'full'] }, then: 'Full' },
                                            { case: { $eq: ['$alerts.type', 'maintenance'] }, then: 'Maintenance Required' },
                                            { case: { $eq: ['$alerts.type', 'offline'] }, then: 'Offline' }
                                        ],
                                        default: 'Alert'
                                    }
                                }
                            ]
                        },
                        description: '$alerts.message',
                        binId: '$binId',
                        timestamp: '$alerts.timestamp',
                        status: {
                            $cond: [{ $eq: ['$alerts.resolved', false] }, 'active', 'resolved']
                        },
                        location: '$location',
                        currentLevel: '$currentLevel'
                    }
                },
                { $sort: { timestamp: -1 } },
                { $limit: parseInt(limit) }
            ]);
            const now = new Date();
            const overflowingBinsWithoutAlerts = await Bin_1.Bin.aggregate([
                {
                    $match: {
                        isOverflowing: true,
                        currentLevel: { $gte: 90 }
                    }
                },
                {
                    $project: {
                        binId: 1,
                        currentLevel: 1,
                        location: 1,
                        alerts: 1,
                        hasActiveOverflowAlert: {
                            $anyElementTrue: {
                                $map: {
                                    input: '$alerts',
                                    as: 'alert',
                                    in: {
                                        $and: [
                                            { $eq: ['$$alert.type', 'overflow'] },
                                            { $eq: ['$$alert.resolved', false] }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                },
                {
                    $match: {
                        hasActiveOverflowAlert: false
                    }
                },
                {
                    $project: {
                        _id: 0,
                        binId: 1,
                        currentLevel: 1,
                        location: 1
                    }
                }
            ]);
            const virtualAlerts = overflowingBinsWithoutAlerts.map((bin) => ({
                id: bin._id?.toString() || '',
                alertId: `${bin.binId}-overflow-${now.getTime()}`,
                type: 'overflow',
                severity: 'critical',
                title: `Bin ${bin.binId} - Overflowing`,
                description: `Bin ${bin.binId} is overflowing at ${bin.currentLevel}%`,
                binId: bin.binId,
                timestamp: now.toISOString(),
                status: 'active',
                location: bin.location,
                currentLevel: bin.currentLevel
            }));
            const allAlerts = [
                ...alertsFromBins.map((a) => ({
                    ...a,
                    timestamp: a.timestamp instanceof Date ? a.timestamp.toISOString() : a.timestamp
                })),
                ...virtualAlerts
            ];
            allAlerts.sort((a, b) => {
                const timeA = new Date(a.timestamp).getTime();
                const timeB = new Date(b.timestamp).getTime();
                return timeB - timeA;
            });
            const limitedAlerts = allAlerts.slice(0, parseInt(limit));
            logger_1.logger.info('Alerts retrieved', {
                count: limitedAlerts.length,
                fromBins: alertsFromBins.length,
                virtualAlerts: virtualAlerts.length,
                filters: { status, type }
            });
            response_1.ResponseHandler.success(res, limitedAlerts, 'Alerts retrieved successfully');
        }
        catch (error) {
            logger_1.logger.error('Get alerts error:', { error });
            response_1.ResponseHandler.error(res, 'Failed to get alerts', 500);
        }
    }
    static async getAlertSummary(_req, res) {
        try {
            const [allAlerts, activeAlerts, resolvedToday] = await Promise.all([
                Bin_1.Bin.aggregate([
                    { $unwind: '$alerts' },
                    {
                        $group: {
                            _id: '$alerts.type',
                            count: { $sum: 1 },
                        },
                    },
                ]),
                Bin_1.Bin.aggregate([
                    { $unwind: '$alerts' },
                    { $match: { 'alerts.resolved': false } },
                    {
                        $group: {
                            _id: '$alerts.type',
                            count: { $sum: 1 },
                        },
                    },
                ]),
                Bin_1.Bin.aggregate([
                    { $unwind: '$alerts' },
                    {
                        $match: {
                            'alerts.resolved': true,
                            'alerts.timestamp': {
                                $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                            },
                        },
                    },
                    { $count: 'total' },
                ]),
            ]);
            const byType = {
                overflow: 0,
                maintenance: 0,
                offline: 0,
                full: 0,
            };
            activeAlerts.forEach((item) => {
                byType[item._id] = item.count ?? 0;
            });
            const totalActive = activeAlerts.reduce((sum, item) => sum + (item.count ?? 0), 0);
            const totalAll = allAlerts.reduce((sum, item) => sum + (item.count ?? 0), 0);
            const bySeverity = {
                low: byType.maintenance || 0,
                medium: byType.offline || 0,
                high: byType.full || 0,
                critical: byType.overflow || 0,
            };
            const alertSummary = {
                totalAlerts: totalAll,
                activeAlerts: totalActive,
                resolvedToday: resolvedToday[0]?.total || 0,
                byType,
                bySeverity,
            };
            logger_1.logger.info('Alert summary retrieved', {
                totalActive,
                resolvedToday: resolvedToday[0]?.total || 0,
            });
            response_1.ResponseHandler.success(res, alertSummary, 'Alert summary retrieved successfully');
        }
        catch (error) {
            logger_1.logger.error('Get alert summary error:', { error });
            response_1.ResponseHandler.error(res, 'Failed to get alert summary', 500);
        }
    }
}
exports.AlertController = AlertController;
//# sourceMappingURL=alertController.js.map