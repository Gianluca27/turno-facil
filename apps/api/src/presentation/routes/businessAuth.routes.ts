import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { authService } from '../../domain/services/AuthService.js';
import { asyncHandler, BadRequestError } from '../middleware/errorHandler.js';
import { authRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimiter.js';
import { authenticateBusinessUser, BusinessAuthenticatedRequest } from '../middleware/auth.js';
import { BusinessUser } from '../../infrastructure/database/mongodb/models/BusinessUser.js';
import { sendGridService } from '../../infrastructure/external/sendgrid/index.js';
import { logger } from '../../utils/logger.js';
import config from '../../config/index.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(2, 'First name is required').max(50),
  lastName: z.string().min(2, 'Last name is required').max(50),
  phone: z.string().optional(),
  businessName: z.string().min(2, 'Business name is required').max(100),
  businessType: z.string().min(2, 'Business type is required'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  device: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// POST /api/v1/business-auth/register - Register new business
router.post(
  '/register',
  authRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const data = registerSchema.parse(req.body);
    const { user, tokens } = await authService.registerBusinessUser(data);

    res.status(201).json({
      success: true,
      message: 'Business registered successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          profile: user.profile,
          businesses: user.businesses,
        },
        tokens,
      },
    });
  })
);

// POST /api/v1/business-auth/login - Login business user
router.post(
  '/login',
  authRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const data = loginSchema.parse(req.body);
    const { user, tokens } = await authService.loginBusinessUser(
      data.email,
      data.password,
      data.device
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          profile: user.profile,
          businesses: user.businesses,
        },
        tokens,
      },
    });
  })
);

// POST /api/v1/business-auth/refresh - Refresh tokens
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const data = refreshSchema.parse(req.body);
    const device = req.headers['x-device-id'] as string;

    const tokens = await authService.refreshTokens(data.refreshToken, device);

    res.json({
      success: true,
      data: { tokens },
    });
  })
);

// POST /api/v1/business-auth/logout - Logout
router.post(
  '/logout',
  authenticateBusinessUser,
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const { refreshToken } = req.body;

    await authService.logout(req.user!.id, refreshToken, 'business_user');

    if (req.token) {
      await authService.revokeToken(req.token);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

// POST /api/v1/business-auth/forgot-password
router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const data = forgotPasswordSchema.parse(req.body);

    const user = await BusinessUser.findOne({ email: data.email.toLowerCase() });

    if (user && user.status === 'active') {
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

      // Save token to user (expires in 1 hour)
      user.passwordResetToken = resetTokenHash;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      // Create reset link
      const resetLink = `${config.app.corsOrigins[0] || 'https://business.turnofacil.com'}/reset-password?token=${resetToken}`;

      // Send reset email
      const emailResult = await sendGridService.sendPasswordReset(user.email, {
        userName: user.profile.firstName,
        resetLink,
        expiresIn: '1 hora',
      });

      if (!emailResult.success) {
        logger.error('Failed to send business password reset email', {
          userId: user._id,
          error: emailResult.error,
        });
      } else {
        logger.info('Business password reset email sent', { userId: user._id });
      }
    }

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link will be sent',
    });
  })
);

// POST /api/v1/business-auth/reset-password
router.post(
  '/reset-password',
  authRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const data = resetPasswordSchema.parse(req.body);

    // Hash the provided token
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(data.token)
      .digest('hex');

    // Find user with valid token
    const user = await BusinessUser.findOne({
      passwordResetToken: resetTokenHash,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    // Update password
    user.password = data.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // Revoke all refresh tokens for security
    user.refreshTokens = [];

    await user.save();

    logger.info('Business password reset successful', { userId: user._id });

    res.json({
      success: true,
      message: 'Password has been reset successfully. Please login with your new password.',
    });
  })
);

// POST /api/v1/business-auth/change-password
router.post(
  '/change-password',
  authenticateBusinessUser,
  asyncHandler(async (req: BusinessAuthenticatedRequest, res: Response) => {
    const data = changePasswordSchema.parse(req.body);

    await authService.changePassword(
      req.user!.id,
      data.currentPassword,
      data.newPassword,
      'business_user'
    );

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  })
);

export default router;
