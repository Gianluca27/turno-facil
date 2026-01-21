import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedisClient } from '../../config/database.js';
import config from '../../config/index.js';
import { TooManyRequestsError } from './errorHandler.js';

// Create Redis store for rate limiting
const createRedisStore = () => {
  try {
    const redisClient = getRedisClient();
    return new RedisStore({
      // @ts-expect-error - Types mismatch between ioredis and rate-limit-redis
      sendCommand: (...args: string[]) => redisClient.call(...args),
      prefix: 'rl:',
    });
  } catch {
    // Fallback to memory store if Redis is not available
    return undefined;
  }
};

// General rate limiter
export const rateLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: { success: false, error: { message: 'Too many requests, please try again later' } },
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many requests, please try again later'));
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return (req as any).user?.id || req.ip || 'unknown';
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

// Strict rate limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.security.authRateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: { success: false, error: { message: 'Too many login attempts, please try again later' } },
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many login attempts, please try again later'));
  },
  keyGenerator: (req) => {
    // Use IP + email/phone for auth endpoints
    const identifier = req.body?.email || req.body?.phone || '';
    return `${req.ip}:${identifier}`;
  },
});

// Very strict rate limiter for OTP requests
export const otpRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 OTP requests per hour per phone number
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: { success: false, error: { message: 'Too many OTP requests, please try again later' } },
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many OTP requests, please try again in an hour'));
  },
  keyGenerator: (req) => {
    return `otp:${req.body?.phone || req.ip}`;
  },
});

// Rate limiter for password reset
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: { success: false, error: { message: 'Too many password reset requests' } },
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many password reset requests, please try again later'));
  },
  keyGenerator: (req) => {
    return `pwd-reset:${req.body?.email || req.ip}`;
  },
});

// Rate limiter for sensitive operations
export const sensitiveOperationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: { success: false, error: { message: 'Too many requests' } },
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many requests for this operation'));
  },
  keyGenerator: (req) => {
    return `sensitive:${(req as any).user?.id || req.ip}`;
  },
});

// Rate limiter for file uploads
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: { success: false, error: { message: 'Too many uploads' } },
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Upload limit exceeded, please try again later'));
  },
  keyGenerator: (req) => {
    return `upload:${(req as any).user?.id || req.ip}`;
  },
});
