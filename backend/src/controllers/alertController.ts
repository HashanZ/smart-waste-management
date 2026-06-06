import { Request, Response } from 'express';
import { ResponseHandler } from '@/utils/response';
import { logger } from '@/utils/logger';
import { Bin } from '@/models/Bin';

export class AlertController {
  /**
   * Get all alerts from all bins
   * Also includes overflowing bins that don't have alerts yet
   */
  static async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { status, type, limit = 100 } = req.query;

      // Build match filter
      const matchStage: any = {};

      if (status === 'active') {
        matchStage['alerts.resolved'] = false;
      } else if (status === 'resolved') {
        matchStage['alerts.resolved'] = true;
      }

      if (type) {
        matchStage['alerts.type'] = type;
      }

      // Get alerts from bins that have alerts
      const alertsFromBins = await Bin.aggregate([
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
        { $limit: parseInt(limit as string) }
      ]);

      // Also get bins that are overflowing but don't have active overflow alerts
      // This ensures all overflowing bins show up in alerts
      const now = new Date();
      const overflowingBinsWithoutAlerts = await Bin.aggregate([
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

      // Convert to alert format in JavaScript (after aggregation)
      const virtualAlerts = overflowingBinsWithoutAlerts.map((bin: any) => ({
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

      // Combine alerts from bins and virtual alerts for overflowing bins without alerts
      const allAlerts = [
        ...alertsFromBins.map((a: any) => ({
          ...a,
          timestamp: a.timestamp instanceof Date ? a.timestamp.toISOString() : a.timestamp
        })),
        ...virtualAlerts
      ];

      // Sort by timestamp descending
      allAlerts.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      });

      // Apply limit
      const limitedAlerts = allAlerts.slice(0, parseInt(limit as string));

      logger.info('Alerts retrieved', {
        count: limitedAlerts.length,
        fromBins: alertsFromBins.length,
        virtualAlerts: virtualAlerts.length,
        filters: { status, type }
      });

      ResponseHandler.success(res, limitedAlerts, 'Alerts retrieved successfully');

    } catch (error: unknown) {
      logger.error('Get alerts error:', { error });
      ResponseHandler.error(res, 'Failed to get alerts', 500);
    }
  }

  /**
   * Get alert summary (counts by type and status)
   */
  static async getAlertSummary(_req: Request, res: Response): Promise<void> {
    try {
      const [allAlerts, activeAlerts, resolvedToday] = await Promise.all([
        Bin.aggregate([
          { $unwind: '$alerts' },
          {
            $group: {
              _id: '$alerts.type',
              count: { $sum: 1 },
            },
          },
        ]),
        Bin.aggregate([
          { $unwind: '$alerts' },
          { $match: { 'alerts.resolved': false } },
          {
            $group: {
              _id: '$alerts.type',
              count: { $sum: 1 },
            },
          },
        ]),
        Bin.aggregate([
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

      // Format by type
      const byType: Record<
        'overflow' | 'maintenance' | 'offline' | 'full',
        number
      > = {
        overflow: 0,
        maintenance: 0,
        offline: 0,
        full: 0,
      };

      (
        activeAlerts as Array<{
          _id: 'overflow' | 'maintenance' | 'offline' | 'full';
          count: number;
        }>
      ).forEach((item) => {
        byType[item._id] = item.count ?? 0;
      });

      const totalActive = (activeAlerts as Array<{ count: number }>).reduce(
        (sum, item) => sum + (item.count ?? 0),
        0,
      );
      const totalAll = (allAlerts as Array<{ count: number }>).reduce(
        (sum, item) => sum + (item.count ?? 0),
        0,
      );

      // Classify by severity
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

      logger.info('Alert summary retrieved', {
        totalActive,
        resolvedToday: resolvedToday[0]?.total || 0,
      });

      ResponseHandler.success(
        res,
        alertSummary,
        'Alert summary retrieved successfully',
      );
    } catch (error: unknown) {
      logger.error('Get alert summary error:', { error });
      ResponseHandler.error(res, 'Failed to get alert summary', 500);
    }
  }
}

