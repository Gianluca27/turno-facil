import winston from 'winston';
import config from '../config/index.js';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom log format for development
const devFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  if (stack) {
    msg += `\n${stack}`;
  }

  return msg;
});

// Create transports based on environment
const transports: winston.transport[] = [];

// Console transport
transports.push(
  new winston.transports.Console({
    format:
      config.app.env === 'development'
        ? combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), devFormat)
        : combine(timestamp(), errors({ stack: true }), json()),
  })
);

// File transports for production
if (config.app.env === 'production') {
  // Error logs
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(timestamp(), errors({ stack: true }), json()),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );

  // Combined logs
  transports.push(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: combine(timestamp(), errors({ stack: true }), json()),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  defaultMeta: {
    service: config.app.name,
    environment: config.app.env,
  },
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Stream for Morgan HTTP logging
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Utility functions for structured logging
export const logRequest = (req: {
  method: string;
  url: string;
  ip?: string;
  userId?: string;
}) => {
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.userId,
  });
};

export const logResponse = (req: { method: string; url: string }, statusCode: number, duration: number) => {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  logger[level]('Request completed', {
    method: req.method,
    url: req.url,
    statusCode,
    duration: `${duration}ms`,
  });
};

export const logError = (error: Error, context?: Record<string, unknown>) => {
  logger.error(error.message, {
    stack: error.stack,
    ...context,
  });
};

export const logDatabaseOperation = (operation: string, collection: string, duration: number, success: boolean) => {
  const level = success ? 'debug' : 'error';
  logger[level]('Database operation', {
    operation,
    collection,
    duration: `${duration}ms`,
    success,
  });
};

export const logExternalService = (
  service: string,
  operation: string,
  success: boolean,
  duration: number,
  metadata?: Record<string, unknown>
) => {
  const level = success ? 'info' : 'error';
  logger[level]('External service call', {
    service,
    operation,
    success,
    duration: `${duration}ms`,
    ...metadata,
  });
};

export default logger;
