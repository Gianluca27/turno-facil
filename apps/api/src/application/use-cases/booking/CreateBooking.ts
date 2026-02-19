import mongoose from 'mongoose';
import { Business } from '../../../infrastructure/database/mongodb/models/Business.js';
import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { Promotion } from '../../../infrastructure/database/mongodb/models/Promotion.js';
import { User } from '../../../infrastructure/database/mongodb/models/User.js';
import { ClientBusinessRelation } from '../../../infrastructure/database/mongodb/models/ClientBusinessRelation.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../../presentation/middleware/errorHandler.js';
import { notificationService } from '../../../domain/services/NotificationService.js';
import { logger } from '../../../utils/logger.js';
import { validateDiscount, calculateDiscountAmount, DiscountResult } from './ValidateDiscount.js';
import { timeToMinutes, minutesToTime, formatDate, ACTIVE_STATUSES } from './shared.js';

export interface CreateBookingInput {
  userId: string;
  businessId: string;
  staffId?: string;
  serviceIds: string[];
  date: string;
  startTime: string;
  notes?: string;
  discountCode?: string;
}

export interface CreateBookingResult {
  appointment: any;
  requiresDeposit: boolean;
  depositAmount: number;
}

/**
 * Creates a new booking/appointment.
 *
 * Orchestrates: user & business validation, service lookup, staff
 * assignment (manual or auto), time-conflict checking, advance-window
 * validation, discount application, pricing, appointment persistence,
 * promotion tracking, client-relationship updates, user-stat updates,
 * and notification scheduling.
 */
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const { userId, businessId, serviceIds, date, startTime, notes, discountCode } = input;

  // ---------- Validate entities ----------
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  const business = await Business.findById(businessId);
  if (!business || business.status !== 'active') {
    throw new NotFoundError('Business not found or not active');
  }

  const services = await Service.find({
    _id: { $in: serviceIds },
    businessId,
    status: 'active',
  });

  if (services.length !== serviceIds.length) {
    throw new BadRequestError('One or more services not found or not available');
  }

  // ---------- Staff resolution ----------
  const staff = input.staffId
    ? await resolveExplicitStaff(input.staffId, businessId, serviceIds)
    : await autoAssignStaff(businessId, serviceIds, services, business, date, startTime);

  // ---------- Duration & time calculation ----------
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

  totalDuration += business.bookingConfig.bufferTime;

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + totalDuration - business.bookingConfig.bufferTime;
  const endTime = minutesToTime(endMinutes);

  const appointmentDate = new Date(date);
  const startDateTime = new Date(`${date}T${startTime}:00`);
  const endDateTime = new Date(`${date}T${endTime}:00`);

  // ---------- Advance-window check ----------
  const now = new Date();
  const minAdvanceMs = business.bookingConfig.minAdvance * 60 * 60 * 1000;
  const maxAdvanceMs = business.bookingConfig.maxAdvance * 24 * 60 * 60 * 1000;

  if (startDateTime < new Date(now.getTime() + minAdvanceMs)) {
    throw new BadRequestError(
      `Bookings must be made at least ${business.bookingConfig.minAdvance} hours in advance`,
    );
  }
  if (startDateTime > new Date(now.getTime() + maxAdvanceMs)) {
    throw new BadRequestError(
      `Bookings cannot be made more than ${business.bookingConfig.maxAdvance} days in advance`,
    );
  }

  // ---------- Final conflict check ----------
  const conflicting = await Appointment.findOne({
    businessId,
    staffId: staff._id,
    date: appointmentDate,
    status: { $in: ACTIVE_STATUSES },
    startDateTime: { $lt: endDateTime },
    endDateTime: { $gt: startDateTime },
  });
  if (conflicting) throw new ConflictError('This time slot is no longer available');

  // ---------- Discount ----------
  let discountAmount = 0;
  let appliedPromotion: DiscountResult | null = null;

  if (discountCode) {
    const promo = await validateDiscount(discountCode, businessId, userId, subtotal, serviceIds);
    if (promo) {
      appliedPromotion = promo;
      discountAmount = calculateDiscountAmount(promo, subtotal);
    }
  }

  // ---------- Pricing ----------
  const total = Math.max(0, subtotal - discountAmount);
  const deposit = business.bookingConfig.requireDeposit
    ? business.bookingConfig.depositType === 'percentage'
      ? (total * business.bookingConfig.depositAmount) / 100
      : Math.min(business.bookingConfig.depositAmount, total)
    : 0;

  // ---------- Persist ----------
  const appointment = new Appointment({
    businessId,
    clientId: userId,
    clientInfo: {
      name: `${user.profile.firstName} ${user.profile.lastName}`,
      phone: user.phone || '',
      email: user.email,
    },
    staffId: staff._id,
    staffInfo: { name: `${staff.profile.firstName} ${staff.profile.lastName}` },
    services: appointmentServices,
    date: appointmentDate,
    startTime,
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
    notes: { client: notes },
    source: 'app_client',
    createdBy: new mongoose.Types.ObjectId(userId),
  });

  await appointment.save();

  // ---------- Side-effects (fire-and-forget where safe) ----------
  if (appliedPromotion) {
    await Promotion.findByIdAndUpdate(appliedPromotion._id, {
      $inc: { currentUses: 1 },
      $push: { usedBy: { userId, appointmentId: appointment._id, usedAt: new Date() } },
    });
  }

  await ClientBusinessRelation.findOneAndUpdate(
    { clientId: userId, businessId },
    {
      $set: { lastVisitAt: new Date() },
      $inc: { totalBookings: 1, totalSpent: total },
      $setOnInsert: { clientId: userId, businessId, firstVisitAt: new Date() },
    },
    { upsert: true },
  );

  await User.findByIdAndUpdate(userId, {
    $inc: { 'stats.totalAppointments': 1, 'stats.totalSpent': total },
  });

  // Notifications
  await notificationService.sendBookingConfirmation({
    userId,
    businessId,
    appointmentId: appointment._id.toString(),
    staffName: appointment.staffInfo.name,
    serviceName: appointmentServices.map((s) => s.name).join(', '),
    date: formatDate(appointmentDate),
    time: startTime,
    price: `$${total.toLocaleString('es-AR')}`,
    address: `${business.location.address}, ${business.location.city}`,
  });

  await notificationService.scheduleReminders({
    _id: appointment._id.toString(),
    clientId: userId,
    businessId,
    startDateTime,
  });

  await notificationService.scheduleReviewRequest({
    userId,
    businessId,
    appointmentId: appointment._id.toString(),
    serviceName: appointmentServices[0].name,
    appointmentEndTime: endDateTime,
  });

  if (business.ownerId) {
    await notificationService.notifyBusinessNewBooking({
      businessId,
      businessUserId: business.ownerId.toString(),
      appointmentId: appointment._id.toString(),
      clientName: appointment.clientInfo.name,
      serviceName: appointmentServices.map((s) => s.name).join(', '),
      date: formatDate(appointmentDate),
      time: startTime,
    });
  }

  logger.info('Booking created', { appointmentId: appointment._id, userId, businessId });

  return {
    appointment,
    requiresDeposit: deposit > 0 && !appointment.pricing.depositPaid,
    depositAmount: deposit,
  };
}

// ---- Internal helpers ----

async function resolveExplicitStaff(staffId: string, businessId: string, serviceIds: string[]) {
  const staff = await Staff.findOne({ _id: staffId, businessId, status: 'active' });
  if (!staff) throw new NotFoundError('Staff not found');

  const staffServiceIds = staff.services.map((s) => s.toString());
  for (const serviceId of serviceIds) {
    if (!staffServiceIds.includes(serviceId)) {
      throw new BadRequestError('Staff does not offer one or more selected services');
    }
  }
  return staff;
}

async function autoAssignStaff(
  businessId: string,
  serviceIds: string[],
  services: any[],
  business: any,
  date: string,
  startTime: string,
) {
  const candidates = await Staff.find({
    businessId,
    status: 'active',
    services: { $all: serviceIds.map((id) => new mongoose.Types.ObjectId(id)) },
  });

  if (candidates.length === 0) {
    throw new BadRequestError('No staff available for the selected services');
  }

  const svcDuration = services.reduce((sum: number, s: any) => sum + s.duration, 0);
  const sMinutes = timeToMinutes(startTime);
  const eMinutes = sMinutes + svcDuration;
  const eTime = minutesToTime(eMinutes);
  const sdt = new Date(`${date}T${startTime}:00`);
  const edt = new Date(`${date}T${eTime}:00`);

  for (const candidate of candidates) {
    const conflict = await Appointment.findOne({
      businessId,
      staffId: candidate._id,
      date: new Date(date),
      status: { $in: ACTIVE_STATUSES },
      startDateTime: { $lt: edt },
      endDateTime: { $gt: sdt },
    });
    if (!conflict) return candidate;
  }

  throw new ConflictError('No staff available at the selected time');
}
