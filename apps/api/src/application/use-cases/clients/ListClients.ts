import { ClientBusinessRelation } from '../../../infrastructure/database/mongodb/models/ClientBusinessRelation.js';

export interface ListClientsInput {
  businessId: string;
  segment?: string;
  page: number;
  limit: number;
}

export interface ListClientsResult {
  clients: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function listClients(input: ListClientsInput): Promise<ListClientsResult> {
  const { businessId, segment, page, limit } = input;

  const query: Record<string, unknown> = { businessId };

  if (segment === 'vip') query['clientInfo.tags'] = 'VIP';
  if (segment === 'blocked') query.isBlocked = true;
  if (segment === 'inactive') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query['stats.lastVisit'] = { $lt: thirtyDaysAgo };
  }

  const skip = (page - 1) * limit;

  const [clients, total] = await Promise.all([
    ClientBusinessRelation.find(query)
      .populate('clientId', 'profile email phone')
      .sort({ 'stats.lastVisit': -1 })
      .skip(skip)
      .limit(limit),
    ClientBusinessRelation.countDocuments(query),
  ]);

  return {
    clients,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}
