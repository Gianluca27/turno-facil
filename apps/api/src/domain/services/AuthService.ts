import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import config from '../../config/index.js';
import { getRedisClient } from '../../config/database.js';
import { User, IUser } from '../../infrastructure/database/mongodb/models/User.js';
import { BusinessUser, IBusinessUser } from '../../infrastructure/database/mongodb/models/BusinessUser.js';
import { UnauthorizedError, BadRequestError, ConflictError } from '../../presentation/middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

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

type UserType = 'user' | 'business_user';

class AuthService {
  // Resolve the correct Mongoose model for a given user type
  private getModel(userType: UserType): typeof User | typeof BusinessUser {
    return userType === 'user' ? User : BusinessUser;
  }

  // Generate access token
  private generateAccessToken(userId: string, userType: UserType): string {
    const jti = uuidv4();
    const payload = {
      sub: userId,
      type: userType,
      jti,
    };

    const options: SignOptions = {
      expiresIn: config.jwt.accessExpiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    } as SignOptions;

    return jwt.sign(payload, config.jwt.accessSecret, options);
  }

  // Generate refresh token
  private generateRefreshToken(userId: string, family?: string): { token: string; family: string; expiresAt: Date } {
    const jti = uuidv4();
    const tokenFamily = family || uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const payload = {
      sub: userId,
      type: 'refresh',
      family: tokenFamily,
      jti,
    };

    const options: SignOptions = {
      expiresIn: config.jwt.refreshExpiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    } as SignOptions;

    const token = jwt.sign(payload, config.jwt.refreshSecret, options);

    return { token, family: tokenFamily, expiresAt };
  }

  // Generate token pair
  async generateTokens(userId: string, userType: UserType, device?: string): Promise<TokenPair> {
    const accessToken = this.generateAccessToken(userId, userType);
    const { token: refreshToken, expiresAt } = this.generateRefreshToken(userId);

    const Model = this.getModel(userType);

    // Save refresh token to user document
    await Model.findByIdAndUpdate(userId, {
      $push: {
        refreshTokens: {
          token: refreshToken,
          device,
          expiresAt,
        },
      },
      lastLoginAt: new Date(),
    });

    // Clean up old refresh tokens (keep max 5)
    await Model.findByIdAndUpdate(userId, {
      $push: {
        refreshTokens: {
          $each: [],
          $slice: -5,
        },
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  // Refresh tokens
  async refreshTokens(refreshToken: string, device?: string): Promise<TokenPair> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, config.jwt.refreshSecret, {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      }) as RefreshTokenPayload;

      if (payload.type !== 'refresh') {
        throw new UnauthorizedError('Invalid token type');
      }

      // Try to find user with this refresh token across both models
      const tokenQuery = {
        _id: payload.sub,
        'refreshTokens.token': refreshToken,
        status: 'active',
      };

      let user: IUser | IBusinessUser | null = await User.findOne(tokenQuery);
      let userType: UserType = 'user';

      if (!user) {
        user = await BusinessUser.findOne(tokenQuery);
        userType = 'business_user';
      }

      if (!user) {
        // Token reuse detected - invalidate all tokens in this family
        logger.warn('Refresh token reuse detected', { userId: payload.sub, family: payload.family });
        await this.revokeAllTokens(payload.sub);
        throw new UnauthorizedError('Token has been revoked');
      }

      // Remove old refresh token and add new one
      const Model = this.getModel(userType);
      const accessToken = this.generateAccessToken(payload.sub, userType);
      const { token: newRefreshToken, expiresAt } = this.generateRefreshToken(payload.sub, payload.family);

      await Model.findByIdAndUpdate(payload.sub, {
        $pull: { refreshTokens: { token: refreshToken } },
      });
      await Model.findByIdAndUpdate(payload.sub, {
        $push: {
          refreshTokens: {
            token: newRefreshToken,
            device,
            expiresAt,
          },
        },
      });

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 900,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      throw error;
    }
  }

  // Revoke specific token
  async revokeToken(token: string): Promise<void> {
    try {
      const payload = jwt.decode(token) as { jti?: string; exp?: number };
      if (payload?.jti && payload?.exp) {
        const redis = getRedisClient();
        const ttl = payload.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redis.setex(`bl:${payload.jti}`, ttl, '1');
        }
      }
    } catch (error) {
      logger.error('Error revoking token:', error);
    }
  }

  // Revoke all tokens for a user
  async revokeAllTokens(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { refreshTokens: [] });
    await BusinessUser.findByIdAndUpdate(userId, { refreshTokens: [] });
  }

  // Logout
  async logout(userId: string, refreshToken?: string, userType: UserType = 'user'): Promise<void> {
    const Model = this.getModel(userType);

    if (refreshToken) {
      await Model.findByIdAndUpdate(userId, {
        $pull: { refreshTokens: { token: refreshToken } },
      });
    } else {
      await Model.findByIdAndUpdate(userId, { refreshTokens: [] });
    }
  }

  // Register user (client app)
  async registerUser(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<{ user: IUser; tokens: TokenPair }> {
    // Check if email already exists
    const existingUser = await User.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Check if phone already exists
    if (data.phone) {
      const existingPhone = await User.findOne({ phone: data.phone });
      if (existingPhone) {
        throw new ConflictError('Phone number already registered');
      }
    }

    // Create user
    const user = new User({
      email: data.email.toLowerCase(),
      password: data.password,
      phone: data.phone,
      profile: {
        firstName: data.firstName,
        lastName: data.lastName,
      },
      status: 'active',
    });

    await user.save();

    // Generate tokens
    const tokens = await this.generateTokens(user._id.toString(), 'user');

    logger.info('New user registered', { userId: user._id, email: user.email });

    return { user, tokens };
  }

  // Login user (client app)
  async loginUser(email: string, password: string, device?: string): Promise<{ user: IUser; tokens: TokenPair }> {
    // Find user with password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedError('Account is not active');
    }

    if (!user.password) {
      throw new UnauthorizedError('Please login with your social account');
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user._id.toString(), 'user', device);

    logger.info('User logged in', { userId: user._id, email: user.email });

    return { user, tokens };
  }

  // Register business user
  async registerBusinessUser(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    businessName: string;
    businessType: string;
  }): Promise<{ user: IBusinessUser; tokens: TokenPair }> {
    const { Business } = await import('../../infrastructure/database/mongodb/models/Business.js');

    // Check if email already exists
    const existingUser = await BusinessUser.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Create business user
    const businessUser = new BusinessUser({
      email: data.email.toLowerCase(),
      password: data.password,
      phone: data.phone,
      profile: {
        firstName: data.firstName,
        lastName: data.lastName,
      },
      businesses: [],
      status: 'active',
    });

    await businessUser.save();

    // Create business
    const business = new Business({
      name: data.businessName,
      type: data.businessType,
      contact: {
        email: data.email.toLowerCase(),
        phone: data.phone || '',
      },
      location: {
        address: '',
        city: '',
        state: '',
        country: 'Argentina',
        coordinates: { type: 'Point', coordinates: [0, 0] },
      },
      ownerId: businessUser._id,
      status: 'pending',
    });

    await business.save();

    // Link business to user
    businessUser.businesses.push({
      businessId: business._id,
      role: 'owner',
      permissions: ['*'],
      joinedAt: new Date(),
    });

    await businessUser.save();

    // Generate tokens
    const tokens = await this.generateTokens(businessUser._id.toString(), 'business_user');

    logger.info('New business registered', { userId: businessUser._id, businessId: business._id });

    return { user: businessUser, tokens };
  }

  // Login business user
  async loginBusinessUser(email: string, password: string, device?: string): Promise<{ user: IBusinessUser; tokens: TokenPair }> {
    const user = await BusinessUser.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedError('Account is not active');
    }

    if (!user.password) {
      throw new UnauthorizedError('Please login with your social account');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const tokens = await this.generateTokens(user._id.toString(), 'business_user', device);

    logger.info('Business user logged in', { userId: user._id, email: user.email });

    return { user, tokens };
  }

  // Social login (Google, Facebook, Apple)
  async socialLogin(
    provider: 'google' | 'facebook' | 'apple',
    providerId: string,
    email: string,
    profile: { firstName: string; lastName: string; avatar?: string },
    device?: string
  ): Promise<{ user: IUser; tokens: TokenPair; isNewUser: boolean }> {
    // Check if user exists with this provider
    let user = await User.findOne({
      'authProviders.provider': provider,
      'authProviders.providerId': providerId,
    });

    let isNewUser = false;

    if (!user) {
      // Check if user exists with this email
      user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        // Link provider to existing account
        user.authProviders.push({ provider, providerId, email });
        await user.save();
      } else {
        // Create new user
        user = new User({
          email: email.toLowerCase(),
          profile: {
            firstName: profile.firstName,
            lastName: profile.lastName,
            avatar: profile.avatar,
          },
          authProviders: [{ provider, providerId, email }],
          status: 'active',
        });
        await user.save();
        isNewUser = true;
      }
    }

    if (user.status !== 'active') {
      throw new UnauthorizedError('Account is not active');
    }

    const tokens = await this.generateTokens(user._id.toString(), 'user', device);

    logger.info('Social login', { userId: user._id, provider, isNewUser });

    return { user, tokens, isNewUser };
  }

  // Change password
  async changePassword(userId: string, currentPassword: string, newPassword: string, userType: UserType): Promise<void> {
    const Model = this.getModel(userType);
    const user = await Model.findById(userId).select('+password');

    if (!user) {
      throw new BadRequestError('User not found');
    }

    if (!user.password) {
      throw new BadRequestError('No password set. Please use social login or reset password.');
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    // Revoke all existing refresh tokens
    await Model.findByIdAndUpdate(userId, { refreshTokens: [] });

    logger.info('Password changed', { userId });
  }
}

export const authService = new AuthService();
