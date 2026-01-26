import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Business } from '../../infrastructure/database/mongodb/models/Business.js';
import { Service } from '../../infrastructure/database/mongodb/models/Service.js';
import { Staff } from '../../infrastructure/database/mongodb/models/Staff.js';
import { Appointment } from '../../infrastructure/database/mongodb/models/Appointment.js';
import { Promotion } from '../../infrastructure/database/mongodb/models/Promotion.js';
import { User } from '../../infrastructure/database/mongodb/models/User.js';
import { ClientBusinessRelation } from '../../infrastructure/database/mongodb/models/ClientBusinessRelation.js';
import { asyncHandler, NotFoundError, BadRequestError, ConflictError } from '../middleware/errorHandler.js';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth.js';
import { notificationService } from '../../domain/services/NotificationService.js';
import { mercadoPagoService } from '../../infrastructure/external/mercadopago/index.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// Validation schemas
const createBookingSchema = z.object({
  businessId: z.string().min(1),
  staffId: z.string().min(1),
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

    // Get user info
    const user = await User.findById(req.user!.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Get business
    const business = await Business.findById(data.businessId);
    if (!business || business.status !== 'active') {
      throw new NotFoundError('Business not found or not active');
    }

    // Check if instant booking is available
    if (!business.bookingConfig.allowInstantBooking && business.bookingConfig.requireConfirmation) {
      // Bookings will require confirmation from the business
    }

    // Get services
    const services = await Service.find({
      _id: { $in: data.serviceIds },
      businessId: data.businessId,
      status: 'active',
    });

    if (services.length !== data.serviceIds.length) {
      throw new BadRequestError('One or more services not found or not available');
    }

    // Get staff
    const staff = await Staff.findOne({
      _id: data.staffId,
      businessId: data.businessId,
      status: 'active',
    });

    if (!staff) {
      throw new NotFoundError('Staff not found');
    }

    // Verify staff offers all selected services
    const staffServiceIds = staff.services.map((s) => s.toString());
    for (const serviceId of data.serviceIds) {
      if (!staffServiceIds.includes(serviceId)) {
        throw new BadRequestError('Staff does not offer one or more selected services');
      }
    }

    // Calculate total duration and price
    let totalDuration = 0;
    let subtotal = 0;
    const appointmentServices = services.map((service) => {
      totalDuration += service.duration;
      const price = service.finalPrice;
      subtotal += price;

      return {
        serviceId: service._id,
        name: service.name,
        duration: service.duration,
        price: service.price,
        discount: service.price - price,
      };
    });

    // Add buffer time
    totalDuration += business.bookingConfig.bufferTime;

    // Calculate end time
    const startMinutes = timeToMinutes(data.startTime);
    const endMinutes = startMinutes + totalDuration - business.bookingConfig.bufferTime;
    const endTime = minutesToTime(endMinutes);

    // Create date objects
    const appointmentDate = new Date(data.date);
    const startDateTime = new Date(`${data.date}T${data.startTime}:00`);
    const endDateTime = new Date(`${data.date}T${endTime}:00`);

    // Check if booking is within allowed advance window
    const now = new Date();
    const minAdvanceHours = business.bookingConfig.minAdvance;
    const maxAdvanceDays = business.bookingConfig.maxAdvance;
    const maxAdvanceDate = new Date(now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000);
    const minAdvanceDate = new Date(now.getTime() + minAdvanceHours * 60 * 60 * 1000);

    if (startDateTime < minAdvanceDate) {
      throw new BadRequestError(`Bookings must be made at least ${minAdvanceHours} hours in advance`);
    }

    if (startDateTime > maxAdvanceDate) {
      throw new BadRequestError(`Bookings cannot be made more than ${maxAdvanceDays} days in advance`);
    }

    // Verify availability
    const conflictingAppointment = await Appointment.findOne({
      businessId: data.businessId,
      staffId: data.staffId,
      date: appointmentDate,
      status: { $in: ['pending', 'confirmed', 'checked_in', 'in_progress'] },
      $or: [
        { startDateTime: { $lt: endDateTime }, endDateTime: { $gt: startDateTime } },
      ],
    });

    if (conflictingAppointment) {
      throw new ConflictError('This time slot is no longer available');
    }

    // Apply discount code if provided
    let discountAmount = 0;
    let appliedPromotion: { _id: mongoose.Types.ObjectId; code: string; discountType: string; discountValue: number } | null = null;

    if (data.discountCode) {
      const promotion = await validateAndApplyDiscount(
        data.discountCode,
        data.businessId,
        req.user!.id,
        subtotal,
        data.serviceIds
      );

      if (promotion) {
        appliedPromotion = {
          _id: promotion._id,
          code: promotion.code,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
        };

        if (promotion.discountType === 'percentage') {
          discountAmount = (subtotal * promotion.discountValue) / 100;
          if (promotion.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, promotion.maxDiscountAmount);
          }
        } else {
          discountAmount = promotion.discountValue;
        }
      }
    }

    // Calculate final pricing
    const total = Math.max(0, subtotal - discountAmount);
    const deposit = business.bookingConfig.requireDeposit
      ? business.bookingConfig.depositType === 'percentage'
        ? (total * business.bookingConfig.depositAmount) / 100
        : Math.min(business.bookingConfig.depositAmount, total)
      : 0;

    // Create appointment
    const appointment = new Appointment({
      businessId: data.businessId,
      clientId: req.user!.id,
      clientInfo: {
        name: `${user.profile.firstName} ${user.profile.lastName}`,
        phone: user.phone || '',
        email: user.email,
      },
      staffId: data.staffId,
      staffInfo: {
        name: `${staff.profile.firstName} ${staff.profile.lastName}`,
      },
      services: appointmentServices,
      date: appointmentDate,
      startTime: data.startTime,
      endTime,
      startDateTime,
      endDateTime,
      totalDuration,
      pricing: {
        subtotal,
        discount: discountAmount,
        discountCode: appliedPromotion?.code,
        promotionId: appliedPromotion?._id,
        deposit,
        depositPaid: false,
        total,
        tip: 0,
        finalTotal: total,
      },
      status: business.bookingConfig.requireConfirmation ? 'pending' : 'confirmed',
      notes: {
        client: data.notes,
      },
      source: 'app_client',
      createdBy: new mongoose.Types.ObjectId(req.user!.id),
    });

    await appointment.save();

    // Update promotion usage if applied
    if (appliedPromotion) {
      await Promotion.findByIdAndUpdate(appliedPromotion._id, {
        $inc: { currentUses: 1 },
        $push: {
          usedBy: {
            userId: req.user!.id,
            appointmentId: appointment._id,
            usedAt: new Date(),
          },
        },
      });
    }

    // Update or create client-business relationship
    await ClientBusinessRelation.findOneAndUpdate(
      { clientId: req.user!.id, businessId: data.businessId },
      {
        $set: { lastVisitAt: new Date() },
        $inc: { totalBookings: 1, totalSpent: total },
        $setOnInsert: {
          clientId: req.user!.id,
          businessId: data.businessId,
          firstVisitAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Update user stats
    await User.findByIdAndUpdate(req.user!.id, {
      $inc: { 'stats.totalAppointments': 1, 'stats.totalSpent': total },
    });

    // Send confirmation notification
    await notificationService.sendBookingConfirmation({
      userId: req.user!.id,
      businessId: data.businessId,
      appointmentId: appointment._id.toString(),
      staffName: appointment.staffInfo.name,
      serviceName: appointmentServices.map(s => s.name).join(', '),
      date: formatDate(appointmentDate),
      time: data.startTime,
      price: `$${total.toLocaleString('es-AR')}`,
      address: `${business.location.address}, ${business.location.city}`,
    });

    // Schedule reminders
    await notificationService.scheduleReminders({
      _id: appointment._id.toString(),
      clientId: req.user!.id,
      businessId: data.businessId,
      startDateTime,
    });

    // Schedule review request
    await notificationService.scheduleReviewRequest({
      userId: req.user!.id,
      businessId: data.businessId,
      appointmentId: appointment._id.toString(),
      serviceName: appointmentServices[0].name,
      appointmentEndTime: endDateTime,
    });

    // Notify business
    if (business.ownerId) {
      await notificationService.notifyBusinessNewBooking({
        businessId: data.businessId,
        businessUserId: business.ownerId.toString(),
        appointmentId: appointment._id.toString(),
        clientName: appointment.clientInfo.name,
        serviceName: appointmentServices.map(s => s.name).join(', '),
        date: formatDate(appointmentDate),
        time: data.startTime,
      });
    }

    logger.info('Booking created', {
      appointmentId: appointment._id,
      userId: req.user!.id,
      businessId: data.businessId,
    });

    res.status(201).json({
      success: true,
      message: appointment.status === 'pending'
        ? 'Booking created and pending confirmation'
        : 'Booking confirmed successfully',
      data: {
        appointment,
        requiresDeposit: deposit > 0 && !appointment.pricing.depositPaid,
        depositAmount: deposit,
      },
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
    const { reason } = req.body;

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      clientId: req.user!.id,
      status: { $in: ['pending', 'confirmed'] },
    }).populate('businessId');

    if (!appointment) {
      throw new NotFoundError('Booking not found or cannot be cancelled');
    }

    const business = appointment.businessId as unknown as typeof Business.prototype;

    // Check cancellation policy
    let refundAmount = 0;
    let penaltyApplied = false;

    if (business?.bookingConfig?.cancellationPolicy?.allowCancellation) {
      const hoursUntilAppointment =
        (appointment.startDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

      if (hoursUntilAppointment < business.bookingConfig.cancellationPolicy.hoursBeforeAppointment) {
        // Apply cancellation penalty
        if (appointment.pricing.depositPaid) {
          const penaltyPercentage = business.bookingConfig.cancellationPolicy.penaltyPercentage || 100;
          const penaltyAmount = (appointment.pricing.deposit * penaltyPercentage) / 100;
          refundAmount = appointment.pricing.deposit - penaltyAmount;
          penaltyApplied = true;
        }
      } else {
        // Full refund if deposit was paid
        refundAmount = appointment.pricing.deposit;
      }
    }

    appointment.status = 'cancelled';
    appointment.cancellation = {
      cancelledAt: new Date(),
      cancelledBy: 'client',
      reason,
      refunded: refundAmount > 0,
      refundAmount,
    };

    await appointment.save();

    // Update user stats
    await User.findByIdAndUpdate(req.user!.id, {
      $inc: { 'stats.cancelledAppointments': 1 },
    });

    // Cancel scheduled reminders
    await notificationService.cancelReminders(appointment._id.toString());

    // Send cancellation notification
    await notificationService.sendBookingCancellation({
      userId: req.user!.id,
      businessId: appointment.businessId._id?.toString() || appointment.businessId.toString(),
      appointmentId: appointment._id.toString(),
      reason,
      cancelledBy: 'client',
    });

    logger.info('Booking cancelled', {
      appointmentId: appointment._id,
      userId: req.user!.id,
      reason,
      penaltyApplied,
    });

    res.json({
      success: true,
      message: penaltyApplied
        ? 'Booking cancelled. Cancellation fee applied due to late cancellation.'
        : 'Booking cancelled successfully',
      data: {
        appointment,
        refundAmount,
        penaltyApplied,
      },
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

    // Check if rescheduling is allowed
    if (!business?.bookingConfig?.allowRescheduling) {
      throw new BadRequestError('Rescheduling is not allowed for this business');
    }

    // Save old times for notification
    const oldDate = formatDate(appointment.date);
    const oldTime = appointment.startTime;

    // Calculate new times
    const newDate = new Date(data.date);
    const startMinutes = timeToMinutes(data.startTime);
    const duration = appointment.totalDuration - (business.bookingConfig?.bufferTime || 0);
    const endMinutes = startMinutes + duration;
    const newEndTime = minutesToTime(endMinutes);

    const newStartDateTime = new Date(`${data.date}T${data.startTime}:00`);
    const newEndDateTime = new Date(`${data.date}T${newEndTime}:00`);

    // Check if new time is valid
    const now = new Date();
    const minAdvanceDate = new Date(now.getTime() + (business.bookingConfig?.minAdvanceMinutes || 60) * 60 * 1000);

    if (newStartDateTime < minAdvanceDate) {
      throw new BadRequestError('New time must be at least the minimum advance time from now');
    }

    // Check availability
    const conflicting = await Appointment.findOne({
      _id: { $ne: appointment._id },
      businessId: appointment.businessId._id || appointment.businessId,
      staffId: appointment.staffId,
      date: newDate,
      status: { $in: ['pending', 'confirmed', 'checked_in', 'in_progress'] },
      $or: [
        { startDateTime: { $lt: newEndDateTime }, endDateTime: { $gt: newStartDateTime } },
      ],
    });

    if (conflicting) {
      throw new ConflictError('The selected time slot is not available');
    }

    // Update appointment
    appointment.date = newDate;
    appointment.startTime = data.startTime;
    appointment.endTime = newEndTime;
    appointment.startDateTime = newStartDateTime;
    appointment.endDateTime = newEndDateTime;

    // Add reschedule to status history
    appointment.statusHistory.push({
      status: 'rescheduled',
      changedBy: new mongoose.Types.ObjectId(req.user!.id),
      changedAt: new Date(),
      reason: `Rescheduled from ${oldDate} ${oldTime} to ${formatDate(newDate)} ${data.startTime}`,
    });

    await appointment.save();

    // Cancel old reminders and schedule new ones
    await notificationService.cancelReminders(appointment._id.toString());
    await notificationService.scheduleReminders({
      _id: appointment._id.toString(),
      clientId: req.user!.id,
      businessId: (appointment.businessId._id || appointment.businessId).toString(),
      startDateTime: newStartDateTime,
    });

    // Send rescheduled notification
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

    // Create MercadoPago preference
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
    const { businessId, staffId, serviceIds, date, startTime } = req.body;

    if (!businessId || !staffId || !serviceIds || !date || !startTime) {
      throw new BadRequestError('All fields are required');
    }

    // Get business for buffer time
    const business = await Business.findById(businessId).select('bookingConfig');

    // Get services to calculate duration
    const services = await Service.find({ _id: { $in: serviceIds } });
    let totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    totalDuration += business?.bookingConfig?.bufferTime || 0;

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = startMinutes + totalDuration - (business?.bookingConfig?.bufferTime || 0);
    const endTime = minutesToTime(endMinutes);

    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);

    const conflicting = await Appointment.findOne({
      businessId,
      staffId,
      date: new Date(date),
      status: { $in: ['pending', 'confirmed', 'checked_in', 'in_progress'] },
      $or: [
        { startDateTime: { $lt: endDateTime }, endDateTime: { $gt: startDateTime } },
      ],
    });

    res.json({
      success: true,
      data: {
        available: !conflicting,
        startTime,
        endTime,
        totalDuration,
      },
    });
  })
);

// POST /api/v1/bookings/calculate-price - Calculate price
router.post(
  '/calculate-price',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { businessId, serviceIds, discountCode } = req.body;

    if (!businessId || !serviceIds?.length) {
      throw new BadRequestError('Business and services are required');
    }

    const services = await Service.find({
      _id: { $in: serviceIds },
      businessId,
      status: 'active',
    });

    let subtotal = 0;
    let totalDuration = 0;
    const items = services.map((service) => {
      const price = service.finalPrice;
      subtotal += price;
      totalDuration += service.duration;

      return {
        serviceId: service._id,
        name: service.name,
        price: service.price,
        finalPrice: price,
        discount: service.price - price,
        duration: service.duration,
      };
    });

    let discountAmount = 0;
    let promotionDetails: { code: string; discountType: string; discountValue: number } | null = null;

    if (discountCode) {
      const promotion = await validateAndApplyDiscount(
        discountCode,
        businessId,
        req.user!.id,
        subtotal,
        serviceIds
      );

      if (promotion) {
        promotionDetails = {
          code: promotion.code,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
        };

        if (promotion.discountType === 'percentage') {
          discountAmount = (subtotal * promotion.discountValue) / 100;
          if (promotion.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, promotion.maxDiscountAmount);
          }
        } else {
          discountAmount = promotion.discountValue;
        }
      }
    }

    const total = Math.max(0, subtotal - discountAmount);

    const business = await Business.findById(businessId).select('bookingConfig');
    const deposit = business?.bookingConfig?.requireDeposit
      ? business.bookingConfig.depositType === 'percentage'
        ? (total * business.bookingConfig.depositAmount) / 100
        : Math.min(business.bookingConfig.depositAmount, total)
      : 0;

    res.json({
      success: true,
      data: {
        items,
        subtotal,
        discount: discountAmount,
        promotion: promotionDetails,
        total,
        deposit,
        totalDuration,
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

    const promotion = await validateAndApplyDiscount(
      discountCode,
      businessId,
      req.user!.id,
      subtotal || 0,
      serviceIds || []
    );

    if (!promotion) {
      res.json({
        success: true,
        data: {
          valid: false,
          message: 'Invalid or expired discount code',
        },
      });
      return;
    }

    let discountAmount = 0;
    if (subtotal) {
      if (promotion.discountType === 'percentage') {
        discountAmount = (subtotal * promotion.discountValue) / 100;
        if (promotion.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, promotion.maxDiscountAmount);
        }
      } else {
        discountAmount = promotion.discountValue;
      }
    }

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

// Utility functions
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function formatDate(date: Date): string {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

async function validateAndApplyDiscount(
  code: string,
  businessId: string,
  _userId: string, // Reserved for future per-user limits
  subtotal: number,
  serviceIds: string[]
): Promise<{
  _id: mongoose.Types.ObjectId;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscountAmount?: number;
} | null> {
  const now = new Date();

  const promotion = await Promotion.findOne({
    businessId,
    code: code.toUpperCase(),
    status: 'active',
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    $or: [
      { maxUses: { $exists: false } },
      { maxUses: null },
      { $expr: { $lt: ['$currentUses', '$maxUses'] } },
    ],
  });

  if (!promotion) {
    return null;
  }

  // Check if total usage limit reached
  if (promotion.limits.totalUses && promotion.limits.currentUses >= promotion.limits.totalUses) {
    return null;
  }

  // Check minimum purchase amount
  if (promotion.conditions.minPurchase && subtotal < promotion.conditions.minPurchase) {
    return null;
  }

  // Check if promotion applies to specific services
  if (promotion.conditions.services && promotion.conditions.services.length > 0) {
    const hasApplicableService = serviceIds.some(
      (id) => promotion.conditions.services!.map((s: mongoose.Types.ObjectId) => s.toString()).includes(id)
    );
    if (!hasApplicableService) {
      return null;
    }
  }

  return {
    _id: promotion._id,
    code: promotion.code || '',
    discountType: promotion.discount.type,
    discountValue: promotion.discount.amount,
    maxDiscountAmount: promotion.discount.maxDiscount,
  };
}

export default router;
