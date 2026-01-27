/**
 * Client Types - Shared types for client-business relationships
 */

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type PreferredChannel = 'push' | 'sms' | 'email' | 'whatsapp';

export interface ClientInfo {
  customName?: string;
  tags?: string[];
  notes?: string;
  allergies?: string[];
  preferences?: string;
}

export interface FavoriteService {
  serviceId: string;
  count: number;
}

export interface ClientStats {
  totalVisits: number;
  totalSpent: number;
  totalCancellations: number;
  totalNoShows: number;
  lastVisit?: string;
  averageSpent: number;
  favoriteServices: FavoriteService[];
  favoriteStaff?: string;
}

export interface LoyaltyInfo {
  points: number;
  tier: LoyaltyTier;
  tierUpdatedAt?: string;
}

export interface CommunicationPreferences {
  allowMarketing: boolean;
  allowReminders: boolean;
  preferredChannel: PreferredChannel;
}

export interface ClientBusinessRelation {
  _id: string;
  clientId: string;
  businessId: string;
  clientInfo: ClientInfo;
  stats: ClientStats;
  loyalty: LoyaltyInfo;
  isBlocked: boolean;
  blockedAt?: string;
  blockedReason?: string;
  communicationPreferences: CommunicationPreferences;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  client?: {
    _id: string;
    email?: string;
    phone?: string;
    profile: {
      firstName: string;
      lastName: string;
      avatar?: string;
    };
  };
}

// API Request Types
export interface CreateClientRequest {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  notes?: string;
  tags?: string[];
}

export interface UpdateClientRequest {
  customName?: string;
  tags?: string[];
  notes?: string;
  allergies?: string[];
  preferences?: string;
}

export interface BlockClientRequest {
  reason: string;
}

export interface SendMessageRequest {
  channel: PreferredChannel;
  message: string;
}

export interface AddNoteRequest {
  note: string;
}

// Client search result
export interface ClientSearchResult {
  _id: string;
  clientId: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  tags: string[];
  stats: Pick<ClientStats, 'totalVisits' | 'totalSpent' | 'lastVisit'>;
  loyalty: Pick<LoyaltyInfo, 'tier' | 'points'>;
  isVip: boolean;
  isBlocked: boolean;
}

// Client detail view
export interface ClientDetail extends ClientBusinessRelation {
  client: {
    _id: string;
    email?: string;
    phone?: string;
    profile: {
      firstName: string;
      lastName: string;
      avatar?: string;
      birthDate?: string;
    };
    createdAt: string;
  };
  recentAppointments?: Array<{
    _id: string;
    date: string;
    status: string;
    services: Array<{ name: string }>;
    staff?: { profile: { firstName: string; lastName: string } };
  }>;
}
