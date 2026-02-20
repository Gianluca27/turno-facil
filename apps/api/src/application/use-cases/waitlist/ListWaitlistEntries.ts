import mongoose from 'mongoose';
import { Waitlist } from '../../../infrastructure/database/mongodb/models/Waitlist.js';
import { logger } from '../../../utils/logger.js';

export interface ListWaitlistEntriesInput {
  businessId: string;
  status?: string;
  serviceId?: string;
  staffId?: string;
  priority?: string;
  page: number;
  limit: number;
}

export interface WaitlistStats {
  active: number;
  fulfilled: number;
  expired: number;
  cancelled: number;
}

export interface ListWaitlistEntriesResult {
  entries: any[];
  stats: WaitlistStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Lists waitlist entries for a business with filtering by status,
 * service, staff, and priority. Includes aggregated stats by status
 * and standard pagination.
 */
export async function listWaitlistEntries(input: ListWaitlistEntriesInput): Promise<ListWaitlistEntriesResult> {
  const {
    businessId,
    status = 'active',
    serviceId,
    staffId,
    priority,
    page,
    limit,
  } = input;

  const pageNum = page;
  const limitNum = Math.min(limit, 50);
  const skip = (pageNum - 1) * limitNum;

  // ---------- Build query ----------
  const query: Record<string, unknown> = { businessId };

  if (status !== 'all') {
    query.status = status;
  }

  if (serviceId) {
    query['preferences.services'] = serviceId;
  }

  if (staffId) {
    query['preferences.staffId'] = staffId;
  }

  if (priority) {
    query.priority = priority;
  }

  // ---------- Fetch entries + count ----------
  const [entries, total] = await Promise.all([
    Waitlist.find(query)
      .populate('clientId', 'profile.firstName profile.lastName email phone')
      .populate('preferences.services', 'name duration price')
      .populate('preferences.staffId', 'profile.firstName profile.lastName')
      .sort({ priority: -1, createdAt: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Waitlist.countDocuments(query),
  ]);

  // ---------- Aggregate stats ----------
  const stats = await Waitlist.aggregate([
    { $match: { businessId: new mongoose.Types.ObjectId(businessId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const statsMap = Object.fromEntries(stats.map((s) => [s._id, s.count]));

  logger.info('Waitlist entries listed', { businessId, total });

  return {
    entries,
    stats: {
      active: statsMap.active || 0,
      fulfilled: statsMap.fulfilled || 0,
      expired: statsMap.expired || 0,
      cancelled: statsMap.cancelled || 0,
    },
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };
}
