import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { config } from '@/config/config';
import { connectDatabase } from '@/config/database';
import { connectRedis } from '@/config/redis';
import { connectMQTT } from '@/config/mqtt';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { notFoundHandler } from '@/middleware/notFoundHandler';
import { requestLogger } from '@/middleware/requestLogger';

// Import routes
import authRoutes from '@/routes/auth';
import binRoutes from '@/routes/bins';
import collectionRoutes from '@/routes/collections';
import routeRoutes from '@/routes/routes';
import analyticsRoutes from '@/routes/analytics';
import adminRoutes from '@/routes/admin';
import alertRoutes from '@/routes/alerts';
import dataCollectionRoutes from '@/routes/dataCollection';

// Import services
import { SocketService } from '@/services/socketService';
import { SchedulerService } from '@/services/scheduler';
import { DataCollector } from '@/services/dataCollector';

class Application {
  public app: express.Application;
  public server: any;
  public io: Server;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST']
      }
    });

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeServices();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors(config.cors));

    // Rate limiting (relaxed for development, strict for production)
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: config.nodeEnv === 'production' ? 100 : 1000, // Higher limit for development
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      // Skip rate limiting for health checks and WebSocket connections
      skip: (req) => {
        return req.path === '/health' || req.path.startsWith('/socket.io');
      }
    });
    this.app.use(limiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression middleware
    this.app.use(compression());

    // Logging middleware
    this.app.use(morgan('combined'));
    this.app.use(requestLogger);
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get('/health', (_req, res) => {
      const mongoose = require('mongoose');
      const dbStatus = mongoose.connection.readyState;
      const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
        database: {
          status: dbStates[dbStatus] || 'unknown',
          connected: dbStatus === 1
        }
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/bins', binRoutes);
    this.app.use('/api/collections', collectionRoutes);
    this.app.use('/api/routes', routeRoutes);
    this.app.use('/api/analytics', analyticsRoutes);
    this.app.use('/api/admin', adminRoutes);
    this.app.use('/api/alerts', alertRoutes);
    this.app.use('/api/data-collection', dataCollectionRoutes);

    // Socket.io connection
    this.app.use('/socket.io', (_req, _res, next) => {
      next();
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  private initializeServices(): void {
    // Initialize Socket.io service
    SocketService.initialize(this.io);

    // Start data collection for ML training
    DataCollector.start();

    // Start scheduler for automated predictions
    SchedulerService.start();
  }

  public async start(): Promise<void> {
    try {
      // Connect to databases (required for routes to work)
      try {
        await connectDatabase();
        logger.info('✅ Database connection established');
      } catch (error: any) {
        logger.error('❌ Database connection failed:', error.message);
        logger.warn('⚠️  Server will start but routes/collections will not work without database');
        // Continue anyway - some endpoints might work
      }

      // Connect to MQTT broker (optional)
      try {
        await connectMQTT();
      } catch (error) {
        logger.warn('MQTT connection failed, continuing without MQTT:', error);
      }

      // Connect to Redis (optional)
      try {
        await connectRedis();
      } catch (error) {
        logger.warn('Redis connection failed, continuing without cache:', error);
      }

      // Start server
      // Use '127.0.0.1' (IPv4) instead of 'localhost' to avoid Windows IPv6 permission issues
      const host = process.env['HOST'] || '127.0.0.1';
      
      // Set socket options to help with Windows port binding
      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EACCES') {
          logger.error(`❌ Permission denied on port ${config.port}. Port ${config.port} is in Windows reserved range (2916-3015).`);
          logger.error('🔧 To fix this, run as Administrator:');
          logger.error(`   netsh int ipv4 add excludedportrange protocol=tcp startport=${config.port} numberofports=1 store=persistent`);
          logger.error('   Or double-click: backend\\fix-port-3000-admin.bat');
          process.exit(1);
        } else {
          logger.error('Server error:', error);
          throw error;
        }
      });
      
      this.server.listen(config.port, host, () => {
        console.log(`🚀 Server running on ${host}:${config.port}`);
        console.log(`📊 Environment: ${config.nodeEnv}`);
        console.log(`🔗 Health check: http://localhost:${config.port}/health`);
      });

      // Background services already started in initializeServices()
      // No need to start scheduler again

      // Graceful shutdown
      process.on('SIGTERM', this.shutdown.bind(this));
      process.on('SIGINT', this.shutdown.bind(this));

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    console.log('🛑 Shutting down server...');

    this.server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('❌ Forced shutdown');
      process.exit(1);
    }, 10000);
  }
}

// Start the application
const app = new Application();
app.start().catch(console.error);

export default app;
