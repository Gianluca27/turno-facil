import mongoose from 'mongoose';
import { ClientBusinessRelation } from '../../../infrastructure/database/mongodb/models/ClientBusinessRelation.js';
import { logger } from '../../../utils/logger.js';

export interface GetClientAnalyticsInput {
  businessId: string;
  startDate?: string;
  endDate?: string;
}

export interface AcquisitionEntry {
  _id: string;
  count: number;
}

export interface TopClientEntry {
  clientId: string | mongoose.Types.ObjectId;
  name: string;
  email: string | undefined;
  totalBookings: number;
  totalSpent: number;
  lastVisit: Date | undefined;
}

export interface SegmentEntry {
  segment: string;
  count: number;
  totalRevenue: number;
}

export interface GetClientAnalyticsResult {
  acquisition: AcquisitionEntry[];
  retention: {
    total: number;
    returning: number;
    loyal: number;
    retentionRate: number;
    loyaltyRate: number;
  };
  topClients: TopClientEntry[];
  segments: SegmentEntry[];
}

const segmentLabels: Record<string | number, string> = {
  0: 'Nuevos (0)',
  1: 'Primera visita (1)',
  2: 'Repetidores (2-4)',
  5: 'Frecuentes (5-9)',
  10: 'Leales (10-19)',
  20: 'VIP (20+)',
  '100+': 'Super VIP',
};

export async function getClientAnalytics(
  input: GetClientAnalyticsInput
): Promise<GetClientAnalyticsResult> {
  const { businessId, startDate, endDate } = input;

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();

  const businessObjId = new mongoose.Types.ObjectId(businessId);

  // Client acquisition
  const acquisition = await ClientBusinessRelation.aggregate([
    {
      $match: {
        businessId: businessObjId,
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Client retention
  const totalClients = await ClientBusinessRelation.countDocuments({
    businessId: businessObjId,
  });

  const returningClients = await ClientBusinessRelation.countDocuments({
    businessId: businessObjId,
    'stats.totalVisits': { $gte: 2 },
  });

  const loyalClients = await ClientBusinessRelation.countDocuments({
    businessId: businessObjId,
    'stats.totalVisits': { $gte: 5 },
  });

  // Top clients
  const topClients = await ClientBusinessRelation.find({
    businessId: businessObjId,
  })
    .sort({ 'stats.totalSpent': -1 })
    .limit(10)
    .populate('clientId', 'profile.firstName profile.lastName email phone')
    .lean();

  // Client segments by visit frequency
  const segments = await ClientBusinessRelation.aggregate([
    {
      $match: {
        businessId: businessObjId,
      },
    },
    {
      $bucket: {
        groupBy: '$stats.totalVisits',
        boundaries: [0, 1, 2, 5, 10, 20, 100],
        default: '100+',
        output: {
          count: { $sum: 1 },
          totalRevenue: { $sum: '$stats.totalSpent' },
        },
      },
    },
  ]);

  logger.info('Client analytics retrieved', { businessId });

  return {
    acquisition,
    retention: {
      total: totalClients,
      returning: returningClients,
      loyal: loyalClients,
      retentionRate: totalClients > 0 ? Math.round((returningClients / totalClients) * 100) : 0,
      loyaltyRate: totalClients > 0 ? Math.round((loyalClients / totalClients) * 100) : 0,
    },
    topClients: topClients.map((c) => {
      const client = c.clientId as unknown as { _id?: string; profile?: { firstName?: string; lastName?: string }; email?: string } | undefined;
      return {
        clientId: client?._id || c.clientId,
        name: client?.profile
          ? `${client.profile.firstName} ${client.profile.lastName}`
          : 'Cliente',
        email: client?.email,
        totalBookings: c.stats.totalVisits,
        totalSpent: c.stats.totalSpent,
        lastVisit: c.stats.lastVisit,
      };
    }),
    segments: segments.map((s) => ({
      segment: segmentLabels[s._id] || `${s._id}+`,
      count: s.count,
      totalRevenue: s.totalRevenue,
    })),
  };
}
