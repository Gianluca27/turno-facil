import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Business } from '../../infrastructure/database/mongodb/models/Business.js';
import { Appointment } from '../../infrastructure/database/mongodb/models/Appointment.js';
import { asyncHandler, NotFoundError, BadRequestError, ConflictError } from '../middleware/errorHandler.js';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth.js';
import { notificationService } from '../../domain/services/NotificationService.js';
import { mercadoPagoService } from '../../infrastructure/external/mercadopago/index.js';
import { logger } from '../../utils/logger.js';
import {
  createBooking,
  cancelBooking,
  checkAvailability,
  calculatePrice,
  validateDiscount,
  calculateDiscountAmount,
  formatDate,
  timeToMinutes,
  minutesToTime,
} from '../../application/use-cases/booking/index.js';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// Validation schemas
const createBookingSchema = z.object({
  businessId: z.string().min(1),
  staffId: z.string().min(1).optional(),
  serviceIds: z.array(z.string()).min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(500).optional(),
  discountCode: z.string().optional(),
});

const rescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
});

// POST /api/v1/bookings - Create new booking
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = createBookingSchema.parse(req.body);

    const result = await createBooking({
      userId: req.user!.id,
      ...data,
    });

    res.status(201).json({
      success: true,
      message: result.appointment.status === 'pending'
        ? 'Booking created and pending confirmation'
        : 'Booking confirmed successfully',
      data: result,
    });
  })
);

// GET /api/v1/bookings - Get user's bookings
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      status,
      upcoming,
      past,
      page = '1',
      limit = '10',
    } = req.query as Record<string, string>;

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    const query: Record<string, unknown> = { clientId: req.user!.id };

    if (status) {
      query.status = status;
    }

    if (upcoming === 'true') {
      query.startDateTime = { $gte: new Date() };
      query.status = { $in: ['pending', 'confirmed'] };
    }

    if (past === 'true') {
      query.$or = [
        { startDateTime: { $lt: new Date() } },
        { status: { $in: ['completed', 'cancelled', 'no_show'] } },
      ];
    }

    const [appointments, total] = await Promise.all([
      Appointment.find(query)
        .populate('businessId', 'name slug media.logo location contact')
        .sort({ startDateTime: upcoming === 'true' ? 1 : -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Appointment.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  })
);

// GET /api/v1/bookings/:id - Get booking details
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      clientId: req.user!.id,
    })
      .populate('businessId', 'name slug media location contact bookingConfig')
      .populate('staffId', 'profile');

    if (!appointment) {
      throw new NotFoundError('Booking not found');
    }

    res.json({
      success: true,
      data: { appointment },
    });
  })
);

// POST /api/v1/bookings/:id/cancel - Cancel booking
router.post(
  '/:id/cancel',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await cancelBooking({
      appointmentId: req.params.id,
      userId: req.user!.id,
      reason: req.body.reason,
    });

    res.json({
      success: true,
      message: result.penaltyApplied
        ? 'Booking cancelled. Cancellation fee applied due to late cancellation.'
        : 'Booking cancelled successfully',
      data: result,
    });
  })
);

// POST /api/v1/bookings/:id/reschedule - Reschedule booking
router.post(
  '/:id/reschedule',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = rescheduleSchema.parse(req.body);

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      clientId: req.user!.id,
      status: { $in: ['pending', 'confirmed'] },
    }).populate('businessId');

    if (!appointment) {
      throw new NotFoundError('Booking not found or cannot be rescheduled');
    }

    const business = appointment.businessId as unknown as typeof Business.prototype;

    if (!business?.bookingConfig?.allowRescheduling) {
      throw new BadRequestError('Rescheduling is not allowed for this business');
    }

    const oldDate = formatDate(appointment.date);
    const oldTime = appointment.startTime;

    const newDate = new Date(data.date);
    const startMinutes = timeToMinutes(data.startTime);
    const duration = appointment.totalDuration - (business.bookingConfig?.bufferTime || 0);
    const endMinutes = startMinutes + duration;
    const newEndTime = minutesToTime(endMinutes);

    const newStartDateTime = new Date(`${data.date}T${data.startTime}:00`);
    const newEndDateTime = new Date(`${data.date}T${newEndTime}:00`);

    const now = new Date();
    const minAdvanceDate = new Date(now.getTime() + (business.bookingConfig?.minAdvanceMinutes || 60) * 60 * 1000);
    if (newStartDateTime < minAdvanceDate) {
      throw new BadRequestError('New time must be at least the minimum advance time from now');
    }

    const conflicting = await Appointment.findOne({
      _id: { $ne: appointment._id },
      businessId: appointment.businessId._id || appointment.businessId,
      staffId: appointment.staffId,
      date: newDate,
      status: { $in: ['pending', 'confirmed', 'checked_in', 'in_progress'] },
      startDateTime: { $lt: newEndDateTime },
      endDateTime: { $gt: newStartDateTime },
    });

    if (conflicting) {
      throw new ConflictError('The selected time slot is not available');
    }

    appointment.date = newDate;
    appointment.startTime = data.startTime;
    appointment.endTime = newEndTime;
    appointment.startDateTime = newStartDateTime;
    appointment.endDateTime = newEndDateTime;

    appointment.statusHistory.push({
      status: 'rescheduled',
      changedBy: new mongoose.Types.ObjectId(req.user!.id),
      changedAt: new Date(),
      reason: `Rescheduled from ${oldDate} ${oldTime} to ${formatDate(newDate)} ${data.startTime}`,
    });

    await appointment.save();

    await notificationService.cancelReminders(appointment._id.toString());
    await notificationService.scheduleReminders({
      _id: appointment._id.toString(),
      clientId: req.user!.id,
      businessId: (appointment.businessId._id || appointment.businessId).toString(),
      startDateTime: newStartDateTime,
    });

    await notificationService.sendBookingRescheduled({
      userId: req.user!.id,
      businessId: (appointment.businessId._id || appointment.businessId).toString(),
      appointmentId: appointment._id.toString(),
      oldDate,
      oldTime,
      newDate: formatDate(newDate),
      newTime: data.startTime,
    });

    logger.info('Booking rescheduled', {
      appointmentId: appointment._id,
      userId: req.user!.id,
      oldDate,
      oldTime,
      newDate: formatDate(newDate),
      newTime: data.startTime,
    });

    res.json({
      success: true,
      message: 'Booking rescheduled successfully',
      data: { appointment },
    });
  })
);

// POST /api/v1/bookings/:id/pay-deposit - Pay deposit for booking
router.post(
  '/:id/pay-deposit',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      clientId: req.user!.id,
      status: { $in: ['pending', 'confirmed'] },
      'pricing.depositPaid': false,
    }).populate('businessId', 'name');

    if (!appointment) {
      throw new NotFoundError('Booking not found or deposit already paid');
    }

    if (appointment.pricing.deposit <= 0) {
      throw new BadRequestError('No deposit required for this booking');
    }

    const business = appointment.businessId as unknown as { name: string };

    const result = await mercadoPagoService.createPreference({
      items: [
        {
          title: `Seña - ${business.name}`,
          description: `Seña para turno del ${formatDate(appointment.date)} a las ${appointment.startTime}`,
          quantity: 1,
          unitPrice: appointment.pricing.deposit,
        },
      ],
      payer: {
        email: appointment.clientInfo.email || '',
        name: appointment.clientInfo.name,
      },
      externalReference: `deposit_${appointment._id}`,
      backUrls: {
        success: `${process.env.APP_URL || 'https://turnofacil.com'}/booking/${appointment._id}/deposit-success`,
        failure: `${process.env.APP_URL || 'https://turnofacil.com'}/booking/${appointment._id}/deposit-failure`,
        pending: `${process.env.APP_URL || 'https://turnofacil.com'}/booking/${appointment._id}/deposit-pending`,
      },
      autoReturn: 'approved',
      metadata: {
        appointmentId: appointment._id.toString(),
        userId: req.user!.id,
        type: 'deposit',
      },
    });

    if (!result.success) {
      throw new BadRequestError('Failed to create payment. Please try again.');
    }

    res.json({
      success: true,
      data: {
        preferenceId: result.preferenceId,
        initPoint: result.initPoint,
        sandboxInitPoint: result.sandboxInitPoint,
        amount: appointment.pricing.deposit,
      },
    });
  })
);

// POST /api/v1/bookings/check-availability - Check availability
router.post(
  '/check-availability',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await checkAvailability(req.body);

    res.json({
      success: true,
      data: result,
    });
  })
);

// POST /api/v1/bookings/calculate-price - Calculate price
router.post(
  '/calculate-price',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await calculatePrice({
      businessId: req.body.businessId,
      serviceIds: req.body.serviceIds,
      discountCode: req.body.discountCode,
      userId: req.user!.id,
    });

    res.json({
      success: true,
      data: {
        items: result.items,
        subtotal: result.subtotal,
        discount: result.discountAmount,
        promotion: result.promotion,
        total: result.total,
        deposit: result.deposit,
        totalDuration: result.totalDuration,
      },
    });
  })
);

// POST /api/v1/bookings/validate-discount - Validate discount code
router.post(
  '/validate-discount',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { businessId, discountCode, subtotal, serviceIds } = req.body;

    if (!businessId || !discountCode) {
      throw new BadRequestError('Business ID and discount code are required');
    }

    const promotion = await validateDiscount(
      discountCode,
      businessId,
      req.user!.id,
      subtotal || 0,
      serviceIds || [],
    );

    if (!promotion) {
      res.json({ success: true, data: { valid: false, message: 'Invalid or expired discount code' } });
      return;
    }

    const discountAmount = subtotal ? calculateDiscountAmount(promotion, subtotal) : 0;

    res.json({
      success: true,
      data: {
        valid: true,
        code: promotion.code,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        discountAmount,
        message: promotion.discountType === 'percentage'
          ? `${promotion.discountValue}% de descuento`
          : `$${promotion.discountValue} de descuento`,
      },
    });
  })
);

export default router;
