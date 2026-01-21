import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { authService } from '../../domain/services/AuthService.js';
import { asyncHandler, BadRequestError, UnauthorizedError } from '../middleware/errorHandler.js';
import { authRateLimiter, otpRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimiter.js';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth.js';
import { User } from '../../infrastructure/database/mongodb/models/User.js';
import { twilioService } from '../../infrastructure/external/twilio/index.js';
import { sendGridService } from '../../infrastructure/external/sendgrid/index.js';
import { googleService } from '../../infrastructure/external/google/index.js';
import { firebaseService } from '../../infrastructure/external/firebase/index.js';
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
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  device: z.string().optional(),
});

const socialLoginSchema = z.object({
  provider: z.enum(['google', 'facebook', 'apple']),
  token: z.string().min(1, 'Token is required'),
  device: z.string().optional(),
});

const phoneLoginSchema = z.object({
  phone: z.string().min(8, 'Phone number is required'),
});

const verifyOTPSchema = z.object({
  phone: z.string().min(8, 'Phone number is required'),
  code: z.string().length(6, 'Code must be 6 digits'),
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

// POST /api/v1/auth/register - Register new user
router.post(
  '/register',
  authRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const data = registerSchema.parse(req.body);
    const { user, tokens } = await authService.registerUser(data);

    // Send welcome email asynchronously
    sendGridService.sendWelcome(user.email, {
      userName: `${user.profile.firstName}`,
    }).catch(err => logger.error('Failed to send welcome email', { error: err }));

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.toPublicJSON(),
        tokens,
      },
    });
  })
);

// POST /api/v1/auth/login - Login with email/password
router.post(
  '/login',
  authRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const data = loginSchema.parse(req.body);
    const { user, tokens } = await authService.loginUser(data.email, data.password, data.device);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toPublicJSON(),
        tokens,
      },
    });
  })
);

// POST /api/v1/auth/social - Social login (Google, Facebook, Apple)
router.post(
  '/social',
  authRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const data = socialLoginSchema.parse(req.body);

    let providerId: string;
    let email: string;
    let profile: { firstName: string; lastName: string; avatar?: string };

    switch (data.provider) {
      case 'google': {
        // Verify with Google OAuth
        const result = await googleService.verifyIdToken(data.token);
        if (!result.success || !result.user) {
          throw new UnauthorizedError('Invalid Google token');
        }
        providerId = result.user.id;
        email = result.user.email;
        profile = {
          firstName: result.user.givenName || result.user.name.split(' ')[0] || '',
          lastName: result.user.familyName || result.user.name.split(' ').slice(1).join(' ') || '',
          avatar: result.user.picture,
        };
        break;
      }

      case 'facebook': {
        // Verify Facebook token by calling Graph API
        try {
          const axios = await import('axios');
          const fbResponse = await axios.default.get(
            `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture.type(large)&access_token=${data.token}`
          );

          if (!fbResponse.data.email) {
            throw new BadRequestError('Email permission is required');
          }

          providerId = fbResponse.data.id;
          email = fbResponse.data.email;
          profile = {
            firstName: fbResponse.data.first_name || '',
            lastName: fbResponse.data.last_name || '',
            avatar: fbResponse.data.picture?.data?.url,
          };
        } catch (error) {
          logger.error('Facebook token verification failed', { error });
          throw new UnauthorizedError('Invalid Facebook token');
        }
        break;
      }

      case 'apple': {
        // For Apple Sign In, the token is a JWT that can be verified
        // In production, you'd verify against Apple's public keys
        try {
          const jwt = await import('jsonwebtoken');
          const decoded = jwt.decode(data.token) as { sub: string; email: string } | null;

          if (!decoded || !decoded.sub || !decoded.email) {
            throw new UnauthorizedError('Invalid Apple token');
          }

          providerId = decoded.sub;
          email = decoded.email;
          profile = {
            firstName: req.body.firstName || 'Apple',
            lastName: req.body.lastName || 'User',
          };
        } catch (error) {
          logger.error('Apple token verification failed', { error });
          throw new UnauthorizedError('Invalid Apple token');
        }
        break;
      }

      default:
        throw new BadRequestError(`Unsupported provider: ${data.provider}`);
    }

    const { user, tokens, isNewUser } = await authService.socialLogin(
      data.provider,
      providerId,
      email,
      profile,
      data.device
    );

    // Send welcome email for new users
    if (isNewUser) {
      sendGridService.sendWelcome(user.email, {
        userName: profile.firstName,
      }).catch(err => logger.error('Failed to send welcome email', { error: err }));
    }

    res.json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      data: {
        user: user.toPublicJSON(),
        tokens,
        isNewUser,
      },
    });
  })
);

// POST /api/v1/auth/login/phone - Login with phone (send OTP)
router.post(
  '/login/phone',
  otpRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const data = phoneLoginSchema.parse(req.body);

    // Send OTP via Twilio
    const result = await twilioService.sendOTP({ phone: data.phone });

    if (!result.success) {
      logger.warn('Failed to send OTP', { phone: data.phone, error: result.error });
      // Don't reveal if the service is unavailable - return success anyway
      // In production with Twilio configured, this would actually send the OTP
    }

    res.json({
      success: true,
      message: 'If this phone number is registered, an OTP has been sent',
      data: {
        phone: data.phone.replace(/(\d{2})\d+(\d{2})/, '$1****$2'),
        expiresIn: 300, // 5 minutes
      },
    });
  })
);

// POST /api/v1/auth/verify-otp - Verify OTP and login
router.post(
  '/verify-otp',
  authRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const data = verifyOTPSchema.parse(req.body);

    // Verify OTP with Twilio
    const verifyResult = await twilioService.verifyOTP({
      phone: data.phone,
      code: data.code,
    });

    if (!verifyResult.success || !verifyResult.valid) {
      throw new UnauthorizedError(verifyResult.error || 'Invalid or expired OTP');
    }

    // Find or create user by phone
    let user = await User.findOne({ phone: data.phone });
    let isNewUser = false;

    if (!user) {
      // Create new user with phone only
      user = new User({
        phone: data.phone,
        phoneVerified: true,
        profile: {
          firstName: 'Usuario',
          lastName: '',
        },
        status: 'active',
      });
      await user.save();
      isNewUser = true;
      logger.info('New user created via phone OTP', { userId: user._id, phone: data.phone });
    } else {
      // Mark phone as verified
      if (!user.phoneVerified) {
        user.phoneVerified = true;
        await user.save();
      }
    }

    // Generate tokens
    const tokens = await authService.generateTokens(user._id.toString(), 'user', data.device);

    res.json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      data: {
        user: user.toPublicJSON(),
        tokens,
        isNewUser,
        requiresProfileCompletion: isNewUser || !user.email,
      },
    });
  })
);

// POST /api/v1/auth/refresh - Refresh tokens
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

// POST /api/v1/auth/logout - Logout
router.post(
  '/logout',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { refreshToken } = req.body;

    await authService.logout(req.user!.id, refreshToken, 'user');

    // Revoke current access token
    if (req.token) {
      await authService.revokeToken(req.token);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

// POST /api/v1/auth/forgot-password - Request password reset
router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const data = forgotPasswordSchema.parse(req.body);

    // Find user by email
    const user = await User.findOne({ email: data.email.toLowerCase() });

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

      // Create reset link (in production, this would be your frontend URL)
      const resetLink = `${config.app.corsOrigins[0] || 'https://turnofacil.com'}/reset-password?token=${resetToken}`;

      // Send reset email
      const emailResult = await sendGridService.sendPasswordReset(user.email, {
        userName: user.profile.firstName,
        resetLink,
        expiresIn: '1 hora',
      });

      if (!emailResult.success) {
        logger.error('Failed to send password reset email', {
          userId: user._id,
          error: emailResult.error
        });
      } else {
        logger.info('Password reset email sent', { userId: user._id });
      }
    }

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link will be sent',
    });
  })
);

// POST /api/v1/auth/reset-password - Reset password with token
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
    const user = await User.findOne({
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

    logger.info('Password reset successful', { userId: user._id });

    res.json({
      success: true,
      message: 'Password has been reset successfully. Please login with your new password.',
    });
  })
);

// POST /api/v1/auth/change-password - Change password (authenticated)
router.post(
  '/change-password',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = changePasswordSchema.parse(req.body);

    await authService.changePassword(
      req.user!.id,
      data.currentPassword,
      data.newPassword,
      'user'
    );

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  })
);

// POST /api/v1/auth/verify-email - Request email verification
router.post(
  '/verify-email',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.user!.id);

    if (!user) {
      throw new BadRequestError('User not found');
    }

    if (user.emailVerified) {
      return res.json({
        success: true,
        message: 'Email is already verified',
      });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    user.emailVerificationToken = verificationTokenHash;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();

    // Send verification email
    const verificationLink = `${config.app.corsOrigins[0] || 'https://turnofacil.com'}/verify-email?token=${verificationToken}`;

    // For now, send a simple email. In production, use a dedicated template.
    await sendGridService.sendEmail({
      to: user.email,
      subject: 'Verificá tu email - TurnoFácil',
      html: `
        <h1>Verificá tu email</h1>
        <p>Hola ${user.profile.firstName},</p>
        <p>Hacé click en el siguiente enlace para verificar tu email:</p>
        <a href="${verificationLink}">Verificar Email</a>
        <p>Este enlace expira en 24 horas.</p>
      `,
    });

    res.json({
      success: true,
      message: 'Verification email sent',
    });
  })
);

// POST /api/v1/auth/confirm-email - Confirm email with token
router.post(
  '/confirm-email',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;

    if (!token) {
      throw new BadRequestError('Verification token is required');
    }

    const verificationTokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      emailVerificationToken: verificationTokenHash,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestError('Invalid or expired verification token');
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    logger.info('Email verified', { userId: user._id });

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  })
);

// POST /api/v1/auth/register-device - Register device for push notifications
router.post(
  '/register-device',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { fcmToken, deviceId, platform } = req.body;

    if (!fcmToken) {
      throw new BadRequestError('FCM token is required');
    }

    const user = await User.findById(req.user!.id);

    if (!user) {
      throw new BadRequestError('User not found');
    }

    // Initialize devices array if it doesn't exist
    if (!user.devices) {
      user.devices = [];
    }

    // Remove existing entry for this device
    user.devices = user.devices.filter(d => d.deviceId !== deviceId);

    // Add new device
    user.devices.push({
      deviceId: deviceId || `device_${Date.now()}`,
      fcmToken,
      platform: platform || 'unknown',
      lastActive: new Date(),
    });

    // Keep only last 5 devices
    if (user.devices.length > 5) {
      user.devices = user.devices.slice(-5);
    }

    await user.save();

    logger.info('Device registered for push notifications', {
      userId: user._id,
      deviceId,
      platform,
    });

    res.json({
      success: true,
      message: 'Device registered successfully',
    });
  })
);

export default router;
