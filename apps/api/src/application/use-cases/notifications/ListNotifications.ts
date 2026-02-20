import mongoose from 'mongoose';
import { Notification } from '../../../infrastructure/database/mongodb/models/Notification.js';
import { logger } from '../../../utils/logger.js';

export interface ListNotificationsInput {
  businessId: string;
  userId: string;
  read?: boolean;
  type?: string;
  page: number;
  limit: number;
}

export interface ListNotificationsResult {
  notifications: any[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Lists notifications for a user within a business, with optional
 * filtering by read status and type, and pagination support.
 */
export async function listNotifications(input: ListNotificationsInput): Promise<ListNotificationsResult> {
  const { businessId, userId, read, type, page, limit } = input;

  const pageNum = page;
  const limitNum = Math.min(limit, 50);
  const skip = (pageNum - 1) * limitNum;

  const query: Record<string, unknown> = {
    businessId: new mongoose.Types.ObjectId(businessId),
    recipientId: new mongoose.Types.ObjectId(userId),
  };

  if (read !== undefined) {
    query.read = read;
  }

  if (type) {
    query.type = type;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({
      businessId: new mongoose.Types.ObjectId(businessId),
      recipientId: new mongoose.Types.ObjectId(userId),
      read: false,
    }),
  ]);

  logger.info('Notifications listed', { businessId, userId, total });

  return {
    notifications,
    unreadCount,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}
