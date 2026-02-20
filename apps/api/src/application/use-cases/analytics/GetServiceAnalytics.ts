import mongoose from 'mongoose';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { Service } from '../../../infrastructure/database/mongodb/models/Service.js';
import { logger } from '../../../utils/logger.js';

export interface GetServiceAnalyticsInput {
  businessId: string;
  startDate?: string;
  endDate?: string;
}

export interface EnrichedService {
  _id: mongoose.Types.ObjectId;
  name: string;
  bookings: number;
  revenue: number;
  avgPrice: number;
  category: unknown;
  duration: number | undefined;
}

export interface CategoryBreakdownEntry {
  _id: string;
  bookings: number;
  revenue: number;
}

export interface GetServiceAnalyticsResult {
  services: EnrichedService[];
  categories: CategoryBreakdownEntry[];
  topServices: EnrichedService[];
}

export async function getServiceAnalytics(
  input: GetServiceAnalyticsInput
): Promise<GetServiceAnalyticsResult> {
  const { businessId, startDate, endDate } = input;

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();

  const businessObjId = new mongoose.Types.ObjectId(businessId);

  // Service performance
  const servicePerformance = await Appointment.aggregate([
    {
      $match: {
        businessId: businessObjId,
        status: 'completed',
        endDateTime: { $gte: start, $lte: end },
      },
    },
    { $unwind: '$services' },
    {
      $group: {
        _id: '$services.serviceId',
        name: { $first: '$services.name' },
        bookings: { $sum: 1 },
        revenue: { $sum: '$services.price' },
        avgPrice: { $avg: '$services.price' },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  // Get service details
  const serviceIds = servicePerformance.map((s) => s._id);
  const services = await Service.find({ _id: { $in: serviceIds } }).select('name categoryId duration').lean();
  const serviceMap = new Map(services.map((s) => [s._id.toString(), s]));

  const enrichedServices = servicePerformance.map((s) => {
    const service = serviceMap.get(s._id?.toString());
    return {
      ...s,
      category: service?.categoryId,
      duration: service?.duration,
    };
  });

  // Category breakdown
  const categoryBreakdown = await Appointment.aggregate([
    {
      $match: {
        businessId: businessObjId,
        status: 'completed',
        endDateTime: { $gte: start, $lte: end },
      },
    },
    { $unwind: '$services' },
    {
      $lookup: {
        from: 'services',
        localField: 'services.serviceId',
        foreignField: '_id',
        as: 'serviceDetails',
      },
    },
    { $unwind: '$serviceDetails' },
    {
      $group: {
        _id: '$serviceDetails.category',
        bookings: { $sum: 1 },
        revenue: { $sum: '$services.price' },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  logger.info('Service analytics retrieved', { businessId });

  return {
    services: enrichedServices,
    categories: categoryBreakdown,
    topServices: enrichedServices.slice(0, 5),
  };
}
