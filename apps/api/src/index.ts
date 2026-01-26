import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { createServer } from 'http';

import config from './config/index.js';
import { initializeDatabases, closeDatabases } from './config/database.js';
import { logger, morganStream } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './presentation/middleware/errorHandler.js';
import { rateLimiter } from './presentation/middleware/rateLimiter.js';
import { setupWebSocket } from './presentation/websocket/index.js';

// Import routes
import authRoutes from './presentation/routes/auth.routes.js';
import businessAuthRoutes from './presentation/routes/businessAuth.routes.js';
import userRoutes from './presentation/routes/user.routes.js';
import exploreRoutes from './presentation/routes/explore.routes.js';
import businessPublicRoutes from './presentation/routes/businessPublic.routes.js';
import bookingRoutes from './presentation/routes/booking.routes.js';
import waitlistRoutes from './presentation/routes/waitlist.routes.js';
import reviewsRoutes from './presentation/routes/reviews.routes.js';
import promotionsRoutes from './presentation/routes/promotions.routes.js';
import webhooksRoutes from './presentation/routes/webhooks.routes.js';
import manageRoutes from './presentation/routes/manage/index.js';
import healthRoutes from './presentation/routes/health.routes.js';

const app: Express = express();
const httpServer = createServer(app);

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (config.app.corsOrigins.includes(origin) || config.app.env === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Device-Id'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit'],
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing
app.use(cookieParser());

// HTTP request logging
if (config.app.env !== 'test') {
  app.use(morgan(
    ':remote-addr - :method :url :status :res[content-length] - :response-time ms',
    { stream: morganStream }
  ));
}

// Rate limiting
app.use(rateLimiter);

// Health check (no auth required)
app.use('/health', healthRoutes);

// API routes
const apiPrefix = config.app.apiPrefix;

// Public routes (authentication)
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/business-auth`, businessAuthRoutes);

// Protected routes - Client App
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/explore`, exploreRoutes);
app.use(`${apiPrefix}/businesses`, businessPublicRoutes);
app.use(`${apiPrefix}/bookings`, bookingRoutes);
app.use(`${apiPrefix}/waitlist`, waitlistRoutes);
app.use(`${apiPrefix}/reviews`, reviewsRoutes);
app.use(`${apiPrefix}/promotions`, promotionsRoutes);

// Webhooks (no auth required, signature verified internally)
app.use(`${apiPrefix}/webhooks`, webhooksRoutes);

// Protected routes - Business App
app.use(`${apiPrefix}/manage`, manageRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Setup WebSocket
setupWebSocket(httpServer);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  httpServer.close(async () => {
    logger.info('HTTP server closed');

    // Close database connections
    await closeDatabases();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejections
process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Rejection:', reason);
  // Don't exit, let the error handler deal with it
});

// Uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start server
const startServer = async () => {
  try {
    // Initialize databases
    await initializeDatabases();

    // Start listening
    httpServer.listen(config.app.port, () => {
      logger.info(`
        ################################################
        🚀 ${config.app.name} is running!
        🔊 Environment: ${config.app.env}
        🔊 Port: ${config.app.port}
        🔊 API: http://localhost:${config.app.port}${config.app.apiPrefix}
        ################################################
      `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { app, httpServer };
