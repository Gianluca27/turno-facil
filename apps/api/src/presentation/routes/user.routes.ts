import { Router, Response } from 'express';
import { z } from 'zod';
import { User } from '../../infrastructure/database/mongodb/models/User.js';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler.js';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// GET /api/v1/users/me - Get current user profile
router.get(
  '/me',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.user!.id);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({
      success: true,
      data: { user: user.toPublicJSON() },
    });
  })
);

// PUT /api/v1/users/me - Update current user profile
router.put(
  '/me',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const updateSchema = z.object({
      profile: z.object({
        firstName: z.string().min(2).max(50).optional(),
        lastName: z.string().min(2).max(50).optional(),
        birthDate: z.string().datetime().optional(),
        gender: z.enum(['male', 'female', 'other', 'prefer_not_say']).optional(),
      }).optional(),
      phone: z.string().optional(),
    });

    const data = updateSchema.parse(req.body);

    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({
      success: true,
      data: { user: user.toPublicJSON() },
    });
  })
);

// DELETE /api/v1/users/me - Delete account
router.delete(
  '/me',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await User.findByIdAndUpdate(req.user!.id, {
      status: 'deleted',
      email: `deleted_${Date.now()}_${req.user!.id}@deleted.com`,
      phone: null,
      refreshTokens: [],
    });

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  })
);

// PUT /api/v1/users/me/preferences - Update preferences
router.put(
  '/me/preferences',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const preferencesSchema = z.object({
      language: z.string().optional(),
      timezone: z.string().optional(),
      theme: z.enum(['light', 'dark', 'system']).optional(),
      notifications: z.object({
        push: z.boolean().optional(),
        email: z.boolean().optional(),
        sms: z.boolean().optional(),
        marketing: z.boolean().optional(),
      }).optional(),
    });

    const data = preferencesSchema.parse(req.body);

    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { $set: { preferences: data } },
      { new: true }
    );

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({
      success: true,
      data: { preferences: user.preferences },
    });
  })
);

// GET /api/v1/users/me/notifications - Get notifications
router.get(
  '/me/notifications',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { Notification } = await import('../../infrastructure/database/mongodb/models/Notification.js');

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find({ recipientType: 'user', recipientId: req.user!.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ recipientType: 'user', recipientId: req.user!.id }),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  })
);

// PUT /api/v1/users/me/notifications/:id/read - Mark notification as read
router.put(
  '/me/notifications/:id/read',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { Notification } = await import('../../infrastructure/database/mongodb/models/Notification.js');

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user!.id },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    res.json({
      success: true,
      data: { notification },
    });
  })
);

// GET /api/v1/users/me/favorites - Get favorites
router.get(
  '/me/favorites',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.user!.id)
      .populate('favorites.businesses', 'name slug media.logo type location.city stats.averageRating')
      .populate('favorites.professionals', 'profile.firstName profile.lastName profile.avatar businessId');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({
      success: true,
      data: { favorites: user.favorites },
    });
  })
);

// GET /api/v1/users/me/appointments - Get user appointments
router.get(
  '/me/appointments',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { Appointment } = await import('../../infrastructure/database/mongodb/models/Appointment.js');

    const status = req.query.status as string;
    const upcoming = req.query.upcoming === 'true';

    const query: any = { clientId: req.user!.id };

    if (status) {
      query.status = status;
    }

    if (upcoming) {
      query.startDateTime = { $gte: new Date() };
      query.status = { $in: ['pending', 'confirmed'] };
    }

    const appointments = await Appointment.find(query)
      .populate('businessId', 'name slug media.logo location')
      .populate('staffId', 'profile')
      .sort({ startDateTime: upcoming ? 1 : -1 })
      .limit(50);

    res.json({
      success: true,
      data: { appointments },
    });
  })
);

export default router;
