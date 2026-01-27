/**
 * Waitlist Types - Shared types for waitlist management
 */

export type WaitlistPriority = 'normal' | 'vip';
export type WaitlistStatus = 'active' | 'fulfilled' | 'cancelled' | 'expired';
export type WaitlistNotificationStatus = 'sent' | 'accepted' | 'expired' | 'declined';

export interface WaitlistDateRange {
  from: string;
  to: string;
}

export interface WaitlistTimeRange {
  from: string;
  to: string;
}

export interface WaitlistPreferences {
  services?: string[];
  staffId?: string;
  dateRange: WaitlistDateRange;
  timeRange?: WaitlistTimeRange;
  daysOfWeek?: number[];
}

export interface WaitlistNotification {
  _id: string;
  appointmentId?: string;
  sentAt: string;
  expiresAt: string;
  status: WaitlistNotificationStatus;
  slot?: {
    date: string;
    startTime: string;
    endTime: string;
    staffName?: string;
  };
}

export interface Waitlist {
  _id: string;
  businessId: string;
  clientId: string;
  preferences: WaitlistPreferences;
  priority: WaitlistPriority;
  position: number;
  notifications: WaitlistNotification[];
  notes?: string;
  status: WaitlistStatus;
  createdAt: string;
  expiresAt?: string;
  // Populated fields
  business?: {
    _id: string;
    name: string;
    slug: string;
    media?: { logo?: string };
  };
  client?: {
    _id: string;
    profile: {
      firstName: string;
      lastName: string;
    };
    phone?: string;
    email?: string;
  };
}

// API Request Types (Client)
export interface JoinWaitlistRequest {
  businessId: string;
  preferences: WaitlistPreferences;
  notes?: string;
}

export interface AcceptWaitlistSlotRequest {
  waitlistId: string;
  notificationId: string;
}

export interface DeclineWaitlistSlotRequest {
  waitlistId: string;
  notificationId: string;
}

// API Request Types (Business)
export interface CreateWaitlistEntryRequest {
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  preferences: WaitlistPreferences;
  priority?: WaitlistPriority;
  notes?: string;
}

export interface NotifyWaitlistRequest {
  waitlistId: string;
  slot: {
    date: string;
    startTime: string;
    endTime: string;
    staffId?: string;
  };
  expiresInMinutes?: number;
}

// Response types
export interface WaitlistPosition {
  position: number;
  estimatedWait?: string;
}
