import mongoose from 'mongoose';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';

export interface GetDailySummaryInput {
  businessId: string;
  date?: string;
}

export interface GetDailySummaryResult {
  date: string;
  overview: {
    totalSales: number;
    totalTransactions: number;
    averageTicket: number;
    refunds: { total: number; count: number };
    netSales: number;
  };
  byPaymentMethod: Record<string, { total: number; count: number }>;
  byType: Record<string, { total: number; count: number }>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  topServices: Array<{ name: string; quantity: number; revenue: number }>;
  hourlyBreakdown: Array<{ hour: string; total: number; count: number }>;
}

export async function getDailySummary(input: GetDailySummaryInput): Promise<GetDailySummaryResult> {
  const { businessId, date } = input;

  const targetDate = date ? new Date(date) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const [salesByMethod, salesByType, topProducts, topServices, hourlyBreakdown] = await Promise.all([
    // Sales by payment method
    Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          type: 'sale',
          status: { $in: ['completed', 'partial_refund'] },
          processedAt: { $gte: targetDate, $lt: nextDay },
        },
      },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$finalTotal' },
          count: { $sum: 1 },
        },
      },
    ]),

    // Sales by type (service vs product)
    Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          type: 'sale',
          status: { $in: ['completed', 'partial_refund'] },
          processedAt: { $gte: targetDate, $lt: nextDay },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.type',
          total: { $sum: '$items.total' },
          count: { $sum: '$items.quantity' },
        },
      },
    ]),

    // Top products
    Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          type: 'sale',
          status: { $in: ['completed', 'partial_refund'] },
          processedAt: { $gte: targetDate, $lt: nextDay },
        },
      },
      { $unwind: '$items' },
      { $match: { 'items.type': 'product' } },
      {
        $group: {
          _id: '$items.name',
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.total' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),

    // Top services
    Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          type: 'sale',
          status: { $in: ['completed', 'partial_refund'] },
          processedAt: { $gte: targetDate, $lt: nextDay },
        },
      },
      { $unwind: '$items' },
      { $match: { 'items.type': 'service' } },
      {
        $group: {
          _id: '$items.name',
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.total' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),

    // Hourly breakdown
    Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
          type: 'sale',
          status: { $in: ['completed', 'partial_refund'] },
          processedAt: { $gte: targetDate, $lt: nextDay },
        },
      },
      {
        $group: {
          _id: { $hour: '$processedAt' },
          total: { $sum: '$finalTotal' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id': 1 } },
    ]),
  ]);

  // Calculate totals
  const totalSales = salesByMethod.reduce((sum: number, s: Record<string, unknown>) => sum + (s.total as number), 0);
  const totalTransactions = salesByMethod.reduce((sum: number, s: Record<string, unknown>) => sum + (s.count as number), 0);

  // Get refunds
  const refunds = await Transaction.aggregate([
    {
      $match: {
        businessId: new mongoose.Types.ObjectId(businessId),
        type: 'refund',
        status: 'completed',
        processedAt: { $gte: targetDate, $lt: nextDay },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$finalTotal' },
        count: { $sum: 1 },
      },
    },
  ]);

  return {
    date: targetDate.toISOString().split('T')[0],
    overview: {
      totalSales,
      totalTransactions,
      averageTicket: totalTransactions > 0 ? totalSales / totalTransactions : 0,
      refunds: refunds[0] || { total: 0, count: 0 },
      netSales: totalSales - (refunds[0]?.total || 0),
    },
    byPaymentMethod: Object.fromEntries(
      salesByMethod.map((s: Record<string, unknown>) => [s._id, { total: s.total, count: s.count }])
    ),
    byType: Object.fromEntries(
      salesByType.map((s: Record<string, unknown>) => [s._id, { total: s.total, count: s.count }])
    ),
    topProducts: topProducts.map((p: Record<string, unknown>) => ({
      name: p._id as string,
      quantity: p.quantity as number,
      revenue: p.revenue as number,
    })),
    topServices: topServices.map((s: Record<string, unknown>) => ({
      name: s._id as string,
      quantity: s.quantity as number,
      revenue: s.revenue as number,
    })),
    hourlyBreakdown: hourlyBreakdown.map((h: Record<string, unknown>) => ({
      hour: `${(h._id as number).toString().padStart(2, '0')}:00`,
      total: h.total as number,
      count: h.count as number,
    })),
  };
}
