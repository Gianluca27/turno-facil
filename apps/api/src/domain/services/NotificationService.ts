import { addJob, scheduleJob, QUEUE_NAMES, NotificationJobData, ReviewRequestJobData } from '../../infrastructure/jobs/queues.js';
import { scheduleAppointmentReminders, cancelAppointmentReminders } from '../../infrastructure/jobs/workers/reminder.worker.js';
import { Notification } from '../../infrastructure/database/mongodb/models/Notification.js';
import { User } from '../../infrastructure/database/mongodb/models/User.js';
// Unused import removed
import { logger } from '../../utils/logger.js';

export interface SendNotificationParams {
  userId: string;
  type: NotificationJobData['type'];
  channels?: ('push' | 'email' | 'sms')[];
  businessId?: string;
  appointmentId?: string;
  data?: Record<string, unknown>;
  scheduledFor?: Date;
}

export interface BulkNotificationParams {
  userIds: string[];
  type: NotificationJobData['type'];
  channels?: ('push' | 'email' | 'sms')[];
  businessId?: string;
  data?: Record<string, unknown>;
}

class NotificationService {
  // Send notification to a single user
  async sendNotification(params: SendNotificationParams): Promise<void> {
    const {
      userId,
      type,
      channels = ['push', 'email'],
      businessId,
      appointmentId,
      data,
      scheduledFor,
    } = params;

    const jobData: NotificationJobData = {
      type,
      userId,
      businessId,
      appointmentId,
      channels,
      data: data || {},
    };

    if (scheduledFor && scheduledFor > new Date()) {
      await scheduleJob(QUEUE_NAMES.NOTIFICATIONS, jobData, scheduledFor);
      logger.info('Notification scheduled', { userId, type, scheduledFor });
    } else {
      await addJob(QUEUE_NAMES.NOTIFICATIONS, jobData);
      logger.info('Notification queued', { userId, type });
    }
  }

  // Send notification to multiple users
  async sendBulkNotification(params: BulkNotificationParams): Promise<void> {
    const { userIds, type, channels = ['push', 'email'], businessId, data } = params;

    for (const userId of userIds) {
      await this.sendNotification({
        userId,
        type,
        channels,
        businessId,
        data,
      });
    }

    logger.info('Bulk notifications queued', {
      userCount: userIds.length,
      type,
    });
  }

  // Send booking confirmation notification
  async sendBookingConfirmation(params: {
    userId: string;
    businessId: string;
    appointmentId: string;
    staffName: string;
    serviceName: string;
    date: string;
    time: string;
    price: string;
    address: string;
  }): Promise<void> {
    await this.sendNotification({
      userId: params.userId,
      type: 'booking_confirmed',
      channels: ['push', 'email', 'sms'],
      businessId: params.businessId,
      appointmentId: params.appointmentId,
      data: {
        staffName: params.staffName,
        serviceName: params.serviceName,
        date: params.date,
        time: params.time,
        price: params.price,
        address: params.address,
      },
    });
  }

  // Send booking cancellation notification
  async sendBookingCancellation(params: {
    userId: string;
    businessId: string;
    appointmentId: string;
    reason?: string;
    cancelledBy: 'client' | 'business';
  }): Promise<void> {
    await this.sendNotification({
      userId: params.userId,
      type: 'booking_cancelled',
      channels: ['push', 'email'],
      businessId: params.businessId,
      appointmentId: params.appointmentId,
      data: {
        reason: params.reason,
        cancelledBy: params.cancelledBy,
      },
    });
  }

  // Send booking rescheduled notification
  async sendBookingRescheduled(params: {
    userId: string;
    businessId: string;
    appointmentId: string;
    oldDate: string;
    oldTime: string;
    newDate: string;
    newTime: string;
  }): Promise<void> {
    await this.sendNotification({
      userId: params.userId,
      type: 'booking_rescheduled',
      channels: ['push', 'email'],
      businessId: params.businessId,
      appointmentId: params.appointmentId,
      data: {
        oldDate: params.oldDate,
        oldTime: params.oldTime,
        newDate: params.newDate,
        newTime: params.newTime,
      },
    });
  }

  // Schedule appointment reminders
  async scheduleReminders(appointment: {
    _id: string;
    clientId: string;
    businessId: string;
    startDateTime: Date;
  }): Promise<void> {
    await scheduleAppointmentReminders({
      _id: appointment._id,
      clientId: appointment.clientId,
      businessId: appointment.businessId,
      startDateTime: appointment.startDateTime,
    });
  }

  // Cancel appointment reminders
  async cancelReminders(appointmentId: string): Promise<void> {
    await cancelAppointmentReminders(appointmentId);
  }

  // Send review request (scheduled for 2 hours after appointment)
  async scheduleReviewRequest(params: {
    userId: string;
    businessId: string;
    appointmentId: string;
    serviceName: string;
    appointmentEndTime: Date;
  }): Promise<void> {
    const reviewRequestTime = new Date(params.appointmentEndTime.getTime() + 2 * 60 * 60 * 1000);

    await scheduleJob<ReviewRequestJobData>(
      QUEUE_NAMES.REVIEWS,
      {
        appointmentId: params.appointmentId,
        userId: params.userId,
        businessId: params.businessId,
        serviceName: params.serviceName,
      },
      reviewRequestTime
    );

    logger.info('Review request scheduled', {
      appointmentId: params.appointmentId,
      scheduledFor: reviewRequestTime,
    });
  }

  // Send promotion notification to all followers of a business
  async sendPromotionNotification(params: {
    businessId: string;
    title: string;
    body: string;
    promotionId?: string;
  }): Promise<void> {
    // Find all users who have favorited this business
    const users = await User.find({
      'favorites.businesses': params.businessId,
      'preferences.notifications.marketing': true,
      status: 'active',
    }).select('_id');

    const userIds = users.map(u => u._id.toString());

    await this.sendBulkNotification({
      userIds,
      type: 'promotion',
      channels: ['push'],
      businessId: params.businessId,
      data: {
        title: params.title,
        body: params.body,
        promotionId: params.promotionId,
      },
    });
  }

  // Send notification to business about new booking
  async notifyBusinessNewBooking(params: {
    businessId: string;
    businessUserId: string;
    appointmentId: string;
    clientName: string;
    serviceName: string;
    date: string;
    time: string;
  }): Promise<void> {
    // This would notify the business user(s)
    // For now, we'll create a notification record
    const notification = new Notification({
      userId: params.businessUserId,
      userType: 'business_user',
      type: 'new_booking',
      title: 'Nueva Reserva',
      body: `${params.clientName} reservó ${params.serviceName} para el ${params.date} a las ${params.time}`,
      businessId: params.businessId,
      appointmentId: params.appointmentId,
      channels: ['push'],
      status: 'sent',
      sentAt: new Date(),
      data: {
        clientName: params.clientName,
        serviceName: params.serviceName,
        date: params.date,
        time: params.time,
      },
    });

    await notification.save();
    logger.info('Business notified of new booking', {
      businessId: params.businessId,
      appointmentId: params.appointmentId,
    });
  }

  // Get user's notifications
  async getUserNotifications(
    userId: string,
    userType: 'user' | 'business_user' = 'user',
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
  ): Promise<{ notifications: any[]; total: number; unreadCount: number }> {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    const query: Record<string, unknown> = {
      userId,
      userType,
      status: { $in: ['sent', 'partial'] },
    };

    if (unreadOnly) {
      query.read = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.getUnreadCount(userType, userId),
    ]);

    return { notifications, total, unreadCount };
  }

  // Mark notification as read
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { read: true, readAt: new Date() }
    );

    return !!notification;
  }

  // Mark all notifications as read
  async markAllAsRead(userId: string, userType: 'user' | 'business_user' = 'user'): Promise<number> {
    const result = await Notification.markAllAsRead(userType, userId);
    return result.modifiedCount;
  }

  // Delete notification
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const result = await Notification.deleteOne({ _id: notificationId, userId });
    return result.deletedCount > 0;
  }

  // Send payment confirmation notification
  async sendPaymentConfirmation(params: {
    userId: string;
    businessId: string;
    appointmentId: string;
    amount: number;
    type: 'deposit' | 'payment';
  }): Promise<void> {
    await this.sendNotification({
      userId: params.userId,
      type: 'payment_received',
      channels: ['push', 'email'],
      businessId: params.businessId,
      appointmentId: params.appointmentId,
      data: {
        amount: params.amount,
        paymentType: params.type,
        formattedAmount: `$${params.amount.toLocaleString('es-AR')}`,
      },
    });

    logger.info('Payment confirmation sent', {
      userId: params.userId,
      appointmentId: params.appointmentId,
      amount: params.amount,
    });
  }

  // Notify next person in waitlist when a slot becomes available
  async notifyNextInWaitlist(
    businessId: string,
    appointmentId?: string
  ): Promise<void> {
    const { Waitlist } = await import('../../infrastructure/database/mongodb/models/Waitlist.js');
    const { Business } = await import('../../infrastructure/database/mongodb/models/Business.js');

    // Find the next active waitlist entry for this business
    const nextInLine = await Waitlist.findOne({
      businessId,
      status: 'active',
    })
      .sort({ priority: -1, position: 1 })
      .limit(1);

    if (!nextInLine) {
      logger.debug('No one in waitlist to notify', { businessId });
      return;
    }

    const business = await Business.findById(businessId).select('name');

    // Create notification for the waitlist entry
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes to respond

    // Create notification entry
    const notificationEntry: { sentAt: Date; expiresAt: Date; status: 'sent'; appointmentId?: any } = {
      sentAt: new Date(),
      expiresAt,
      status: 'sent',
    };

    if (appointmentId) {
      const mongoose = await import('mongoose');
      notificationEntry.appointmentId = new mongoose.default.Types.ObjectId(appointmentId);
    }

    nextInLine.notifications.push(notificationEntry as any);

    await nextInLine.save();

    // Send push notification
    await this.sendNotification({
      userId: nextInLine.clientId.toString(),
      type: 'waitlist_available',
      channels: ['push', 'sms'],
      businessId,
      data: {
        waitlistId: nextInLine._id.toString(),
        businessName: business?.name || 'El negocio',
        expiresAt: expiresAt.toISOString(),
        message: `¡Hay un turno disponible en ${business?.name || 'el negocio'}! Tenés 30 minutos para confirmarlo.`,
      },
    });

    logger.info('Waitlist notification sent', {
      waitlistId: nextInLine._id,
      userId: nextInLine.clientId,
      businessId,
    });
  }
}

export const notificationService = new NotificationService();
