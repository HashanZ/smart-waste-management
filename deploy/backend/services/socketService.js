"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketService = void 0;
const logger_1 = require("../utils/logger");
class SocketService {
    static initialize(io) {
        this.io = io;
        this.setupConnectionHandlers();
    }
    static setupConnectionHandlers() {
        this.io.on('connection', (socket) => {
            logger_1.logger.info(`Client connected: ${socket.id}`);
            socket.on('join-role', (role) => {
                socket.join(role);
                logger_1.logger.info(`Client ${socket.id} joined role room: ${role}`);
            });
            socket.on('join-bin', (binId) => {
                socket.join(`bin-${binId}`);
                logger_1.logger.info(`Client ${socket.id} joined bin room: ${binId}`);
            });
            socket.on('join-collector', (collectorId) => {
                socket.join(`collector-${collectorId}`);
                logger_1.logger.info(`Client ${socket.id} joined collector room: ${collectorId}`);
            });
            socket.on('disconnect', () => {
                logger_1.logger.info(`Client disconnected: ${socket.id}`);
            });
        });
    }
    static emitBinUpdate(bin) {
        if (!this.io) {
            logger_1.logger.warn('Socket.io not initialized, cannot emit bin update');
            return;
        }
        const updateData = {
            binId: bin.binId || bin._id?.toString(),
            binObjectId: bin._id?.toString(),
            currentLevel: bin.currentLevel,
            batteryLevel: bin.metadata?.batteryLevel,
            signalStrength: bin.metadata?.signalStrength,
            isOverflowing: bin.isOverflowing,
            lastDataReceived: bin.metadata?.lastDataReceived,
            status: bin.status,
            location: bin.location,
            updatedAt: bin.updatedAt || new Date()
        };
        this.io.to(`bin-${bin._id}`).emit('bin:update', updateData);
        this.io.to('admin').to('municipal_officer').emit('bin:update', updateData);
        this.io.emit('bin:update', updateData);
        const connectedClients = this.getConnectedClients();
        logger_1.logger.info('Bin update emitted via Socket.io', {
            binId: bin._id || bin.binId,
            level: bin.currentLevel,
            connectedClients,
            eventName: 'bin:update'
        });
    }
    static emitBinDeletion(binId) {
        if (!this.io)
            return;
        this.io.to(`bin-${binId}`).emit('bin-deleted', { binId });
        this.io.to('admin').to('municipal_officer').emit('bin-deleted', { binId });
    }
    static emitAlert(alert) {
        if (!this.io) {
            logger_1.logger.warn('Socket.io not initialized, cannot emit alert');
            return;
        }
        this.io.emit('alert:new', alert);
        this.io.to('admin').to('municipal_officer').emit('alert:new', alert);
        const connectedClients = this.getConnectedClients();
        logger_1.logger.info('Alert emitted via Socket.io', {
            type: alert.type,
            binId: alert.binId,
            severity: alert.severity,
            connectedClients,
            eventName: 'alert:new'
        });
    }
    static emitRouteUpdate(route) {
        if (!this.io)
            return;
        this.io.to(`collector-${route.collectorId}`).emit('route:update', route);
        this.io.to('admin').to('municipal_officer').emit('route:update', {
            routeId: route._id,
            routeNumber: route.routeId,
            name: route.name,
            status: route.status,
            collectorId: route.collectorId,
            binsCount: route.bins.length,
            completionPercentage: route.completionPercentage
        });
        logger_1.logger.debug('Route update emitted via Socket.io', { routeId: route._id });
    }
    static emitRouteDeletion(routeId) {
        if (!this.io)
            return;
        this.io.emit('route:deleted', { routeId });
        logger_1.logger.debug('Route deletion emitted via Socket.io', { routeId });
    }
    static emitCollectionUpdate(collectionData) {
        if (!this.io)
            return;
        this.io.emit('collection:update', collectionData);
    }
    static emitSystemStatus(status) {
        if (!this.io)
            return;
        this.io.emit('system-status', status);
    }
    static getConnectedClients() {
        if (!this.io)
            return 0;
        return this.io.engine.clientsCount;
    }
}
exports.SocketService = SocketService;
//# sourceMappingURL=socketService.js.map