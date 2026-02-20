import mongoose from 'mongoose';

/**
 * Builds a MongoDB query object to select clients matching
 * the given audience segment or custom filters.
 */
export async function buildAudienceQuery(
  businessId: string,
  targetAudience: string | undefined,
  customFilters?: {
    lastVisitDaysAgo?: number;
    totalVisits?: number;
    totalSpent?: number;
    services?: string[];
    staff?: string[];
  }
): Promise<Record<string, unknown>> {
  const query: Record<string, unknown> = {
    businessId: new mongoose.Types.ObjectId(businessId),
  };

  const now = new Date();

  switch (targetAudience) {
    case 'new':
      // Clients with only 1 booking
      query.totalBookings = 1;
      break;

    case 'returning':
      // Clients with 2+ bookings
      query.totalBookings = { $gte: 2 };
      break;

    case 'inactive': {
      // Clients who haven't visited in 60+ days
      const inactiveDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      query.lastVisitAt = { $lt: inactiveDate };
      break;
    }

    case 'custom':
      if (customFilters) {
        if (customFilters.totalVisits !== undefined) {
          query.totalBookings = { ...query.totalBookings as object, $gte: customFilters.totalVisits };
        }
        if (customFilters.totalSpent !== undefined) {
          query.totalSpent = { $gte: customFilters.totalSpent };
        }
        if (customFilters.lastVisitDaysAgo !== undefined) {
          const lastVisitDate = new Date(now.getTime() - customFilters.lastVisitDaysAgo * 24 * 60 * 60 * 1000);
          query.lastVisitAt = { $gte: lastVisitDate };
        }
      }
      break;

    case 'all':
    default:
      // All clients with valid email/phone
      break;
  }

  return query;
}
