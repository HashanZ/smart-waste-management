import mongoose from 'mongoose';
import { config } from './config';
import { logger } from '@/utils/logger';

export const connectDatabase = async (retries: number = 3): Promise<void> => {
  const mongoUri = config.database.mongodbUri;

  if (!mongoUri) {
    throw new Error('MongoDB URI is not defined');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`Attempting to connect to MongoDB (attempt ${attempt}/${retries})...`);

      // Disconnect if already connected
      if (mongoose.connection.readyState === 1) {
        logger.info('Already connected to MongoDB');
        return;
      }

      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
        retryWrites: true,
        retryReads: true,
      });

      logger.info('✅ Connected to MongoDB successfully');
      return;
    } catch (error: any) {
      logger.warn(`MongoDB connection attempt ${attempt}/${retries} failed:`, error.message);

      if (attempt < retries) {
        const waitTime = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
        logger.info(`Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        logger.error('❌ All MongoDB connection attempts failed');
        throw error;
      }
    }
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error);
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (error) => {
  logger.error('Mongoose connection error:', error);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});
