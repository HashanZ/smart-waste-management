import { Server, Socket } from 'socket.io';
import { logger } from '@/utils/logger';

export class SocketService {
  private static io: Server;

  static initialize(io: Server): void {
    this.io = io;
    this.setupConnectionHandlers();
  }

  private static setupConnectionHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client connected: ${socket.id}`);

      // Join user to their role-based room
      socket.on('join-role', (role: string) => {
        socket.join(role);
        logger.info(`Client ${socket.id} joined role room: ${role}`);
      });

      // Join user to specific bin room for real-time updates
      socket.on('join-bin', (binId: string) => {
        socket.join(`bin-${binId}`);
        logger.info(`Client ${socket.id} joined bin room: ${binId}`);
      });

      // Join user to collector room for route updates
      socket.on('join-collector', (collectorId: string) => {
        socket.join(`collector-${collectorId}`);
        logger.info(`Client ${socket.id} joined collector room: ${collectorId}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  static emitBinUpdate(bin: any): void {
    if (!this.io) {
      logger.warn('Socket.io not initialized, cannot emit bin update');
      return;
    }

    const updateData = {
      binId: bin.binId || bin._id?.toString(), // Use the string binId (e.g., "BIN-DOWNTOWN-001")
      binObjectId: bin._id?.toString(), // MongoDB ObjectId for reference
      currentLevel: bin.currentLevel,
      batteryLevel: bin.metadata?.batteryLevel,
      signalStrength: bin.metadata?.signalStrength,
      isOverflowing: bin.isOverflowing,
      lastDataReceived: bin.metadata?.lastDataReceived,
      status: bin.status,
      location: bin.location,
      updatedAt: bin.updatedAt || new Date()
    };

    // Emit to specific bin room
    this.io.to(`bin-${bin._id}`).emit('bin:update', updateData);

    // Emit to admin/municipal officers (frontend listens for 'bin:update')
    this.io.to('admin').to('municipal_officer').emit('bin:update', updateData);

    // Also emit globally for backwards compatibility
    this.io.emit('bin:update', updateData);

    const connectedClients = this.getConnectedClients();
    logger.info('Bin update emitted via Socket.io', {
      binId: bin._id || bin.binId,
      level: bin.currentLevel,
      connectedClients,
      eventName: 'bin:update'
    });
  }

  static emitBinDeletion(binId: string): void {
    if (!this.io) return;

    this.io.to(`bin-${binId}`).emit('bin-deleted', { binId });
    this.io.to('admin').to('municipal_officer').emit('bin-deleted', { binId });
  }

  static emitAlert(alert: any): void {
    if (!this.io) {
      logger.warn('Socket.io not initialized, cannot emit alert');
      return;
    }

    // Emit to all connected clients
    this.io.emit('alert:new', alert);

    // Emit to specific role rooms based on severity/type
    this.io.to('admin').to('municipal_officer').emit('alert:new', alert);

    const connectedClients = this.getConnectedClients();
    logger.info('Alert emitted via Socket.io', {
      type: alert.type,
      binId: alert.binId,
      severity: alert.severity,
      connectedClients,
      eventName: 'alert:new'
    });
  }

  static emitRouteUpdate(route: any): void {
    if (!this.io) return;

    // Emit to specific collector
    this.io.to(`collector-${route.collectorId}`).emit('route:update', route);

    // Emit to admins and municipal officers
    this.io.to('admin').to('municipal_officer').emit('route:update', {
      routeId: route._id,
      routeNumber: route.routeId,
      name: route.name,
      status: route.status,
      collectorId: route.collectorId,
      binsCount: route.bins.length,
      completionPercentage: route.completionPercentage
    });

    logger.debug('Route update emitted via Socket.io', { routeId: route._id });
  }

  static emitRouteDeletion(routeId: string): void {
    if (!this.io) return;

    this.io.emit('route:deleted', { routeId });
    logger.debug('Route deletion emitted via Socket.io', { routeId });
  }

  static emitCollectionUpdate(collectionData: any): void {
    if (!this.io) return;

    this.io.emit('collection:update', collectionData);
  }

  static emitSystemStatus(status: {
    totalBins: number;
    activeBins: number;
    overflowingBins: number;
    maintenanceBins: number;
    lastUpdate: Date;
  }): void {
    if (!this.io) return;

    this.io.emit('system-status', status);
  }

  static getConnectedClients(): number {
    if (!this.io) return 0;
    return this.io.engine.clientsCount;
  }
}


