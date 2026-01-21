import mongoose from 'mongoose';
import Redis from 'ioredis';
import config from './index.js';
import { logger } from '../utils/logger.js';

// MongoDB Connection
let mongoConnection: typeof mongoose | null = null;

export const connectMongoDB = async (): Promise<typeof mongoose> => {
  if (mongoConnection) {
    return mongoConnection;
  }

  try {
    mongoose.set('strictQuery', true);

    // Connection event handlers
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to app termination');
      process.exit(0);
    });

    mongoConnection = await mongoose.connect(config.database.mongodb.uri, {
      ...config.database.mongodb.options,
    });

    logger.info(`MongoDB connected to: ${config.database.mongodb.uri.split('@').pop()}`);

    return mongoConnection;
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
};

export const disconnectMongoDB = async (): Promise<void> => {
  if (mongoConnection) {
    await mongoose.connection.close();
    mongoConnection = null;
    logger.info('MongoDB connection closed');
  }
};

// Redis Connection
let redisClient: Redis | null = null;

export const connectRedis = (): Redis => {
  if (redisClient) {
    return redisClient;
  }

  redisClient = new Redis(config.database.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.error('Redis connection failed after 10 retries');
        return null;
      }
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connecting...');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client connected and ready');
  });

  redisClient.on('error', (err) => {
    logger.error('Redis client error:', err);
  });

  redisClient.on('close', () => {
    logger.warn('Redis client connection closed');
  });

  redisClient.on('reconnecting', () => {
    logger.info('Redis client reconnecting...');
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed due to app termination');
    }
  });

  return redisClient;
};

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    return connectRedis();
  }
  return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};

// Initialize all database connections
export const initializeDatabases = async (): Promise<void> => {
  await connectMongoDB();
  connectRedis();
};

// Close all database connections
export const closeDatabases = async (): Promise<void> => {
  await disconnectMongoDB();
  await disconnectRedis();
};
