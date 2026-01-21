import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../../config/index.js';
import { UnauthorizedError, ForbiddenError } from './errorHandler.js';
import { getRedisClient } from '../../config/database.js';
import { User } from '../../infrastructure/database/mongodb/models/User.js';
import { BusinessUser } from '../../infrastructure/database/mongodb/models/BusinessUser.js';

// Token payload interfaces
export interface AccessTokenPayload {
  sub: string;
  type: 'user' | 'business_user';
  iat: number;
  exp: number;
  jti: string;
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  family: string;
  iat: number;
  exp: number;
  jti: string;
}

// Extended Request interface with user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    type: 'user' | 'business_user';
    email?: string;
  };
  token?: string;
}

// Extended Request for business users with business context
export interface BusinessAuthenticatedRequest extends AuthenticatedRequest {
  businessUser?: {
    id: string;
    email: string;
    businesses: Array<{
      businessId: string;
      role: string;
      permissions: string[];
    }>;
  };
  currentBusiness?: {
    businessId: string;
    role: string;
    permissions: string[];
  };
}

// Extract token from request
const extractToken = (req: Request): string | null => {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  return null;
};

// Check if token is blacklisted
const isTokenBlacklisted = async (jti: string): Promise<boolean> => {
  try {
    const redis = getRedisClient();
    const result = await redis.get(`bl:${jti}`);
    return result !== null;
  } catch {
    // If Redis is unavailable, allow the request
    return false;
  }
};

// Authentication middleware for client app users
export const authenticateUser = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError('Access token required');
    }

    // Verify token
    const payload = jwt.verify(token, config.jwt.accessSecret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as AccessTokenPayload;

    // Check if it's a user token
    if (payload.type !== 'user') {
      throw new UnauthorizedError('Invalid token type');
    }

    // Check if token is blacklisted
    if (await isTokenBlacklisted(payload.jti)) {
      throw new UnauthorizedError('Token has been revoked');
    }

    // Verify user exists and is active
    const user = await User.findById(payload.sub).select('_id email status').lean();

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedError('User account is not active');
    }

    // Attach user to request
    req.user = {
      id: payload.sub,
      type: 'user',
      email: user.email,
    };
    req.token = token;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid access token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Access token expired'));
    } else {
      next(error);
    }
  }
};

// Authentication middleware for business app users
export const authenticateBusinessUser = async (
  req: BusinessAuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError('Access token required');
    }

    // Verify token
    const payload = jwt.verify(token, config.jwt.accessSecret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as AccessTokenPayload;

    // Check if it's a business_user token
    if (payload.type !== 'business_user') {
      throw new UnauthorizedError('Invalid token type');
    }

    // Check if token is blacklisted
    if (await isTokenBlacklisted(payload.jti)) {
      throw new UnauthorizedError('Token has been revoked');
    }

    // Verify user exists and is active
    const businessUser = await BusinessUser.findById(payload.sub)
      .select('_id email status businesses')
      .lean();

    if (!businessUser) {
      throw new UnauthorizedError('User not found');
    }

    if (businessUser.status !== 'active') {
      throw new UnauthorizedError('User account is not active');
    }

    // Attach user to request
    req.user = {
      id: payload.sub,
      type: 'business_user',
      email: businessUser.email,
    };
    req.businessUser = {
      id: businessUser._id.toString(),
      email: businessUser.email,
      businesses: businessUser.businesses.map((b: any) => ({
        businessId: b.businessId.toString(),
        role: b.role,
        permissions: b.permissions,
      })),
    };
    req.token = token;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid access token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Access token expired'));
    } else {
      next(error);
    }
  }
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      return next();
    }

    const payload = jwt.verify(token, config.jwt.accessSecret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as AccessTokenPayload;

    if (await isTokenBlacklisted(payload.jti)) {
      return next();
    }

    req.user = {
      id: payload.sub,
      type: payload.type,
    };
    req.token = token;

    next();
  } catch {
    // Token invalid or expired, continue without auth
    next();
  }
};

// Middleware to set current business context
export const setBusinessContext = (businessIdParam: string = 'businessId') => {
  return async (
    req: BusinessAuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.businessUser) {
        throw new UnauthorizedError('Authentication required');
      }

      // Get business ID from params, query, or header
      const businessId =
        req.params[businessIdParam] ||
        req.query.businessId as string ||
        req.headers['x-business-id'] as string;

      if (!businessId) {
        // If user has only one business, use that
        if (req.businessUser.businesses.length === 1) {
          req.currentBusiness = req.businessUser.businesses[0];
          return next();
        }
        throw new ForbiddenError('Business ID required');
      }

      // Find the business in user's businesses
      const business = req.businessUser.businesses.find(
        (b) => b.businessId === businessId
      );

      if (!business) {
        throw new ForbiddenError('Access denied to this business');
      }

      req.currentBusiness = business;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Permission check middleware
export const requirePermission = (...requiredPermissions: string[]) => {
  return async (
    req: BusinessAuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.currentBusiness) {
        throw new ForbiddenError('Business context required');
      }

      const { role, permissions } = req.currentBusiness;

      // Owner has all permissions
      if (role === 'owner') {
        return next();
      }

      // Check if user has wildcard permission
      if (permissions.includes('*')) {
        return next();
      }

      // Check each required permission
      const hasPermission = requiredPermissions.every((required) => {
        // Check exact match
        if (permissions.includes(required)) {
          return true;
        }

        // Check wildcard for category (e.g., 'appointments:*' matches 'appointments:read')
        const [category] = required.split(':');
        if (permissions.includes(`${category}:*`)) {
          return true;
        }

        return false;
      });

      if (!hasPermission) {
        throw new ForbiddenError('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Role check middleware
export const requireRole = (...allowedRoles: string[]) => {
  return async (
    req: BusinessAuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.currentBusiness) {
        throw new ForbiddenError('Business context required');
      }

      if (!allowedRoles.includes(req.currentBusiness.role)) {
        throw new ForbiddenError('Insufficient role');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
