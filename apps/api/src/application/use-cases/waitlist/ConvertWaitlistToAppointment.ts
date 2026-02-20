import mongoose from 'mongoose';
import { Waitlist } from '../../../infrastructure/database/mongodb/models/Waitlist.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';
import { User } from '../../../infrastructure/database/mongodb/models/User.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../../presentation/middleware/errorHandler.js';
import { notificationService } from '../../../domain/services/NotificationService.js';
import { logger } from '../../../utils/logger.js';
import { timeToMinutes, minutesToTime } from '../booking/shared.js';

export interface ConvertWaitlistToAppointmentInput {
  waitlistId: string;
  businessId: string;
  userId: string;
  staffId: string;
  date: string;
  startTime: string;
}

export interface ConvertWaitlistToAppointmentResult {
  appointment: any;
}

/**
 * Converts an active waitlist entry into a confirmed appointment.
 *
 * Calculates appointment times from services, checks for scheduling
 * conflicts, creates the appointment with source='waitlist', marks
 * the waitlist entry as fulfilled, and sends a confirmation
 * notification to the client.
 */
export async function convertWaitlistToAppointment(
  input: ConvertWaitlistToAppointmentInput,
): Promise<ConvertWaitlistToAppointmentResult> {
  const { waitlistId, businessId, userId, staffId, date, startTime } = input;

  if (!staffId || !date || !startTime) {
    throw new BadRequestError('Staff, date and time are required');
  }

  // ---------- Load waitlist entry ----------
  const entry = await Waitlist.findOne({
    _id: waitlistId,
    businessId,
    status: 'active',
  }).populate('preferences.services');

  if (!entry) {
    throw new NotFoundError('Waitlist entry not found');
  }

  const services = entry.preferences.services as unknown as Array<{
    _id: mongoose.Types.ObjectId;
    name: string;
    duration: number;
    price: number;
  }>;

  // ---------- Calculate times ----------
  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + totalDuration;
  const endTime = minutesToTime(endMinutes);

  const appointmentDate = new Date(date);
  const startDateTime = new Date(`${date}T${startTime}:00`);
  const endDateTime = new Date(`${date}T${endTime}:00`);

  // ---------- Check availability ----------
  const conflicting = await Appointment.findOne({
    businessId,
    staffId,
    date: appointmentDate,
    status: { $in: ['pending', 'confirmed'] },
    $or: [
      { startDateTime: { $lt: endDateTime }, endDateTime: { $gt: startDateTime } },
    ],
  });

  if (conflicting) {
    throw new ConflictError('This time slot is not available');
  }

  // ---------- Get staff & client info ----------
  const staff = await Staff.findById(staffId).select('profile');
  const client = await User.findById(entry.clientId).select('profile email phone');

  // ---------- Create appointment ----------
  const subtotal = services.reduce((sum, s) => sum + s.price, 0);

  const appointment = new Appointment({
    businessId,
    clientId: entry.clientId,
    clientInfo: client
      ? {
          name: `${client.profile.firstName} ${client.profile.lastName}`,
          phone: client.phone || '',
          email: client.email,
        }
      : undefined,
    staffId,
    staffInfo: {
      name: staff ? `${staff.profile.firstName} ${staff.profile.lastName}` : 'Staff',
    },
    services: services.map((s) => ({
      serviceId: s._id,
      name: s.name,
      duration: s.duration,
      price: s.price,
      discount: 0,
    })),
    date: appointmentDate,
    startTime,
    endTime,
    startDateTime,
    endDateTime,
    totalDuration,
    pricing: {
      subtotal,
      discount: 0,
      deposit: 0,
      depositPaid: false,
      total: subtotal,
      tip: 0,
      finalTotal: subtotal,
    },
    status: 'confirmed',
    source: 'waitlist',
    notes: {
      internal: `Converted from waitlist #${entry._id}`,
    },
    createdBy: new mongoose.Types.ObjectId(userId),
  });

  await appointment.save();

  // ---------- Update waitlist entry ----------
  entry.status = 'fulfilled';
  if (!entry.notifications) {
    entry.notifications = [];
  }
  entry.notifications.push({
    appointmentId: appointment._id,
    sentAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'accepted',
  });
  await entry.save();

  // ---------- Notify client ----------
  if (entry.clientId) {
    await notificationService.sendNotification({
      userId: entry.clientId.toString(),
      type: 'booking_confirmed',
      channels: ['push', 'email'],
      businessId,
      appointmentId: appointment._id.toString(),
      data: {
        fromWaitlist: true,
      },
    });
  }

  logger.info('Waitlist converted to appointment', {
    waitlistId: entry._id,
    appointmentId: appointment._id,
    businessId,
  });

  return { appointment };
}
