import { ClientBusinessRelation } from '../../../infrastructure/database/mongodb/models/ClientBusinessRelation.js';
import { buildAudienceQuery } from './shared.js';

export interface PreviewAudienceInput {
  businessId: string;
  targetAudience: string;
  customFilters?: {
    lastVisitDaysAgo?: number;
    totalVisits?: number;
    totalSpent?: number;
    services?: string[];
    staff?: string[];
  };
}

export interface AudienceSampleItem {
  name: string;
  email?: string;
  totalBookings: number;
  totalSpent: number;
}

export interface PreviewAudienceResult {
  count: number;
  sample: AudienceSampleItem[];
}

/**
 * Previews the audience count and a sample of up to 5 clients
 * matching the given audience criteria.
 */
export async function previewAudience(input: PreviewAudienceInput): Promise<PreviewAudienceResult> {
  const { businessId, targetAudience, customFilters } = input;

  const audienceQuery = await buildAudienceQuery(businessId, targetAudience, customFilters);

  const [count, sample] = await Promise.all([
    ClientBusinessRelation.countDocuments(audienceQuery),
    ClientBusinessRelation.find(audienceQuery)
      .populate('clientId', 'profile.firstName profile.lastName email')
      .limit(5)
      .lean(),
  ]);

  const sampleItems: AudienceSampleItem[] = sample.map((c) => {
    const client = c.clientId as unknown as { profile?: { firstName?: string; lastName?: string }; email?: string } | null;
    return {
      name: client?.profile
        ? `${client.profile.firstName || ''} ${client.profile.lastName || ''}`.trim() || 'Cliente'
        : 'Cliente',
      email: client?.email,
      totalBookings: c.stats.totalVisits,
      totalSpent: c.stats.totalSpent,
    };
  });

  return {
    count,
    sample: sampleItems,
  };
}
