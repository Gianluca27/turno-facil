import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Waitlist } from '../../infrastructure/database/mongodb/models/Waitlist.js';
import { Business } from '../../infrastructure/database/mongodb/models/Business.js';
import { Appointment } from '../../infrastructure/database/mongodb/models/Appointment.js';
import { asyncHandler, NotFoundError, BadRequestError, ConflictError } from '../middleware/errorHandler.js';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth.js';
import { notificationService } from '../../domain/services/NotificationService.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// Validation schemas
const createWaitlistSchema = z.object({
  businessId: z.string().min(1),
  preferences: z.object({
    services: z.array(z.string()).optional(),
    staffId: z.string().optional(),
    dateRange: z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    timeRange: z.object({
      from: z.string().regex(/^\d{2}:\d{2}$/),
      to: z.string().regex(/^\d{2}:\d{2}$/),
    }).optional(),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  }),
  notes: z.string().max(500).optional(),
});

// POST /api/v1/waitlist - Join waitlist
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = createWaitlistSchema.parse(req.body);

    // Check if business exists and allows waitlist
    const business = await Business.findById(data.businessId);
    if (!business || business.status !== 'active') {
      throw new NotFoundError('Business not found');
    }

    if (!business.bookingConfig.allowWaitlist) {
      throw new BadRequestError('This business does not have a waitlist');
    }

    // Check if user already has an active waitlist entry for this business
    const existingEntry = await Waitlist.findOne({
      businessId: data.businessId,
      clientId: req.user!.id,
      status: 'active',
    });

    if (existingEntry) {
      throw new ConflictError('You are already on the waitlist for this business');
    }

    // Calculate position
    const lastEntry = await Waitlist.findOne({
      businessId: data.businessId,
      status: 'active',
    }).sort({ position: -1 });

    const position = (lastEntry?.position || 0) + 1;

    // Create waitlist entry
    const waitlistEntry = new Waitlist({
      businessId: data.businessId,
      clientId: req.user!.id,
      preferences: {
        services: data.preferences.services?.map((id) => new mongoose.Types.ObjectId(id)),
        staffId: data.preferences.staffId ? new mongoose.Types.ObjectId(data.preferences.staffId) : undefined,
        dateRange: {
          from: new Date(data.preferences.dateRange.from),
          to: new Date(data.preferences.dateRange.to),
        },
        timeRange: data.preferences.timeRange,
        daysOfWeek: data.preferences.daysOfWeek,
      },
      priority: 'normal',
      position,
      status: 'active',
      expiresAt: new Date(data.preferences.dateRange.to),
    });

    await waitlistEntry.save();

    logger.info('User joined waitlist', {
      waitlistId: waitlistEntry._id,
      userId: req.user!.id,
      businessId: data.businessId,
      position,
    });

    res.status(201).json({
      success: true,
      message: 'Successfully added to waitlist',
      data: {
        waitlist: waitlistEntry,
        position,
      },
    });
  })
);

// GET /api/v1/waitlist/me - Get my waitlist entries
router.get(
  '/me',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status = 'active' } = req.query;

    const query: Record<string, unknown> = { clientId: req.user!.id };

    if (status !== 'all') {
      query.status = status;
    }

    const entries = await Waitlist.find(query)
      .populate('businessId', 'name slug media.logo location')
      .populate('preferences.services', 'name')
      .populate('preferences.staffId', 'profile.firstName profile.lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { waitlist: entries },
    });
  })
);

// GET /api/v1/waitlist/:id - Get specific waitlist entry
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const entry = await Waitlist.findOne({
      _id: req.params.id,
      clientId: req.user!.id,
    })
      .populate('businessId', 'name slug media.logo location contact')
      .populate('preferences.services', 'name price duration')
      .populate('preferences.staffId', 'profile');

    if (!entry) {
      throw new NotFoundError('Waitlist entry not found');
    }

    res.json({
      success: true,
      data: { waitlist: entry },
    });
  })
);

// DELETE /api/v1/waitlist/:id - Leave waitlist
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const entry = await Waitlist.findOne({
      _id: req.params.id,
      clientId: req.user!.id,
      status: 'active',
    });

    if (!entry) {
      throw new NotFoundError('Waitlist entry not found or already cancelled');
    }

    entry.status = 'cancelled';
    await entry.save();

    logger.info('User left waitlist', {
      waitlistId: entry._id,
      userId: req.user!.id,
    });

    res.json({
      success: true,
      message: 'Successfully removed from waitlist',
    });
  })
);

// POST /api/v1/waitlist/:id/notifications/:notificationId/accept - Accept available slot
router.post(
  '/:id/notifications/:notificationId/accept',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const entry = await Waitlist.findOne({
      _id: req.params.id,
      clientId: req.user!.id,
      status: 'active',
    });

    if (!entry) {
      throw new NotFoundError('Waitlist entry not found');
    }

    // Find notification by index (notificationId is the array index)
    const notificationIndex = parseInt(req.params.notificationId, 10);
    const notification = entry.notifications[notificationIndex];

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    if (notification.status !== 'sent') {
      throw new BadRequestError('This offer has already been responded to');
    }

    // Check if offer expired
    if (notification.expiresAt && new Date() > notification.expiresAt) {
      notification.status = 'expired';
      await entry.save();
      throw new BadRequestError('This offer has expired');
    }

    // Check if the appointment slot is still available
    if (notification.appointmentId) {
      const releasedAppointment = await Appointment.findById(notification.appointmentId);

      if (releasedAppointment && releasedAppointment.status === 'cancelled') {
        // Slot was from a cancelled appointment, we can book it
        // Here you would typically redirect to booking flow with pre-filled data
        notification.status = 'accepted';
        entry.status = 'fulfilled';
        await entry.save();

        res.json({
          success: true,
          message: 'Slot accepted! Please complete your booking.',
          data: {
            appointmentDetails: {
              date: releasedAppointment.date,
              startTime: releasedAppointment.startTime,
              staffId: releasedAppointment.staffId,
              services: releasedAppointment.services,
            },
          },
        });
        return;
      }
    }

    notification.status = 'accepted';
    entry.status = 'fulfilled';
    await entry.save();

    logger.info('User accepted waitlist offer', {
      waitlistId: entry._id,
      userId: req.user!.id,
      notificationId: req.params.notificationId,
    });

    res.json({
      success: true,
      message: 'Slot accepted! Redirecting to booking.',
    });
  })
);

// POST /api/v1/waitlist/:id/notifications/:notificationId/decline - Decline available slot
router.post(
  '/:id/notifications/:notificationId/decline',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const entry = await Waitlist.findOne({
      _id: req.params.id,
      clientId: req.user!.id,
      status: 'active',
    });

    if (!entry) {
      throw new NotFoundError('Waitlist entry not found');
    }

    // Find notification by index (notificationId is the array index)
    const notificationIndex = parseInt(req.params.notificationId, 10);
    const notification = entry.notifications[notificationIndex];

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    if (notification.status !== 'sent') {
      throw new BadRequestError('This offer has already been responded to');
    }

    notification.status = 'declined';
    await entry.save();

    // Notify next person in waitlist
    await notificationService.notifyNextInWaitlist(
      entry.businessId.toString(),
      notification.appointmentId?.toString()
    );

    logger.info('User declined waitlist offer', {
      waitlistId: entry._id,
      userId: req.user!.id,
      notificationId: req.params.notificationId,
    });

    res.json({
      success: true,
      message: 'Offer declined. You remain on the waitlist.',
    });
  })
);

export default router;
