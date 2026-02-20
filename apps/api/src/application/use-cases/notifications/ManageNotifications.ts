import mongoose from 'mongoose';
import { Notification } from '../../../infrastructure/database/mongodb/models/Notification.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

// --- Get Unread Count ---

export interface GetUnreadCountInput {
  businessId: string;
  userId: string;
}

export interface GetUnreadCountResult {
  count: number;
}

/**
 * Returns the count of unread notifications for a user within a business.
 */
export async function getUnreadCount(input: GetUnreadCountInput): Promise<GetUnreadCountResult> {
  const { businessId, userId } = input;

  const count = await Notification.countDocuments({
    businessId: new mongoose.Types.ObjectId(businessId),
    recipientId: new mongoose.Types.ObjectId(userId),
    read: false,
  });

  return { count };
}

// --- Mark As Read ---

export interface MarkAsReadInput {
  notificationId: string;
  businessId: string;
  userId: string;
}

export interface MarkAsReadResult {
  notification: any;
}

/**
 * Marks a single notification as read by its ID.
 */
export async function markAsRead(input: MarkAsReadInput): Promise<MarkAsReadResult> {
  const { notificationId, businessId, userId } = input;

  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      businessId: new mongoose.Types.ObjectId(businessId),
      recipientId: new mongoose.Types.ObjectId(userId),
    },
    {
      read: true,
      readAt: new Date(),
    },
    { new: true }
  );

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  logger.info('Notification marked as read', { notificationId, businessId, userId });

  return { notification };
}

// --- Mark All As Read ---

export interface MarkAllAsReadInput {
  businessId: string;
  userId: string;
}

export interface MarkAllAsReadResult {
  modifiedCount: number;
}

/**
 * Marks all unread notifications as read for a user within a business.
 */
export async function markAllAsRead(input: MarkAllAsReadInput): Promise<MarkAllAsReadResult> {
  const { businessId, userId } = input;

  const result = await Notification.updateMany(
    {
      businessId: new mongoose.Types.ObjectId(businessId),
      recipientId: new mongoose.Types.ObjectId(userId),
      read: false,
    },
    {
      read: true,
      readAt: new Date(),
    }
  );

  logger.info('All notifications marked as read', { businessId, userId, modifiedCount: result.modifiedCount });

  return { modifiedCount: result.modifiedCount };
}

// --- Delete Notification ---

export interface DeleteNotificationInput {
  notificationId: string;
  businessId: string;
  userId: string;
}

export interface DeleteNotificationResult {
  success: boolean;
}

/**
 * Deletes a single notification by its ID.
 */
export async function deleteNotification(input: DeleteNotificationInput): Promise<DeleteNotificationResult> {
  const { notificationId, businessId, userId } = input;

  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    businessId: new mongoose.Types.ObjectId(businessId),
    recipientId: new mongoose.Types.ObjectId(userId),
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  logger.info('Notification deleted', { notificationId, businessId, userId });

  return { success: true };
}
