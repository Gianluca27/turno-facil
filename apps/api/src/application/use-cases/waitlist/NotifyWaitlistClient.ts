import mongoose from 'mongoose';
import { Waitlist } from '../../../infrastructure/database/mongodb/models/Waitlist.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { notificationService } from '../../../domain/services/NotificationService.js';
import { logger } from '../../../utils/logger.js';

export interface NotifyWaitlistClientInput {
  waitlistId: string;
  businessId: string;
  appointmentId?: string;
  availableSlots?: any;
}

/**
 * Sends an availability notification to a waitlist client via push,
 * email, and SMS. Records the notification in the entry's notification
 * history with a 24-hour expiry.
 */
export async function notifyWaitlistClient(input: NotifyWaitlistClientInput): Promise<void> {
  const { waitlistId, businessId, appointmentId, availableSlots } = input;

  const entry = await Waitlist.findOne({
    _id: waitlistId,
    businessId,
    status: 'active',
  }).populate('preferences.services', 'name');

  if (!entry) {
    throw new NotFoundError('Waitlist entry not found');
  }

  // ---------- Send notification ----------
  if (entry.clientId) {
    const services = entry.preferences.services as unknown as { name: string }[];
    await notificationService.sendNotification({
      userId: entry.clientId.toString(),
      type: 'general',
      channels: ['push', 'email', 'sms'],
      businessId,
      data: {
        title: '¡Hay disponibilidad!',
        body: `Hay un turno disponible para ${services[0]?.name || 'tu servicio'}`,
        availableSlots,
        waitlistId: entry._id.toString(),
      },
    });
  }

  // ---------- Add notification record ----------
  if (!entry.notifications) {
    entry.notifications = [];
  }

  if (appointmentId) {
    entry.notifications.push({
      appointmentId: new mongoose.Types.ObjectId(appointmentId),
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours expiry
      status: 'sent',
    });
  }

  await entry.save();

  logger.info('Waitlist notification sent', { waitlistId: entry._id, businessId });
}
