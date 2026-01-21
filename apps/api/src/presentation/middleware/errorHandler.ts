import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { logger } from '../../utils/logger.js';
import config from '../../config/index.js';

// Custom error classes
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    options?: {
      isOperational?: boolean;
      code?: string;
      details?: unknown;
    }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = options?.isOperational ?? true;
    this.code = options?.code;
    this.details = options?.details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: unknown) {
    super(message, 400, { code: 'BAD_REQUEST', details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, { code: 'UNAUTHORIZED' });
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, { code: 'FORBIDDEN' });
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, { code: 'NOT_FOUND' });
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409, { code: 'CONFLICT' });
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: unknown) {
    super(message, 422, { code: 'VALIDATION_ERROR', details });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, { code: 'TOO_MANY_REQUESTS' });
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, { code: 'INTERNAL_SERVER_ERROR', isOperational: false });
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
    stack?: string;
  };
}

// Format Zod validation errors
const formatZodErrors = (error: ZodError): Record<string, string[]> => {
  const formatted: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(err.message);
  });

  return formatted;
};

// Not found handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
};

// Global error handler
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_SERVER_ERROR';
  let details: unknown = undefined;
  let isOperational = false;

  // Handle AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code || code;
    details = err.details;
    isOperational = err.isOperational;
  }
  // Handle Zod validation errors
  else if (err instanceof ZodError) {
    statusCode = 422;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    details = formatZodErrors(err);
    isOperational = true;
  }
  // Handle Mongoose validation errors
  else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    details = Object.entries(err.errors).reduce(
      (acc, [key, value]) => {
        acc[key] = [value.message];
        return acc;
      },
      {} as Record<string, string[]>
    );
    isOperational = true;
  }
  // Handle Mongoose CastError (invalid ObjectId)
  else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
    code = 'INVALID_ID';
    isOperational = true;
  }
  // Handle Mongoose duplicate key error
  else if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    statusCode = 409;
    const field = Object.keys((err as any).keyValue)[0];
    message = `${field} already exists`;
    code = 'DUPLICATE_KEY';
    isOperational = true;
  }
  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
    isOperational = true;
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
    isOperational = true;
  }
  // Handle SyntaxError (invalid JSON)
  else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON';
    code = 'INVALID_JSON';
    isOperational = true;
  }

  // Log error
  if (!isOperational) {
    logger.error('Unhandled error:', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
      userId: (req as any).user?.id,
    });
  } else {
    logger.warn('Operational error:', {
      error: err.message,
      statusCode,
      url: req.url,
      method: req.method,
    });
  }

  // Build error response
  const response: ErrorResponse = {
    success: false,
    error: {
      message,
      code,
      details,
    },
  };

  // Include stack trace in development
  if (config.app.env === 'development') {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

// Async handler wrapper to catch errors
export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
