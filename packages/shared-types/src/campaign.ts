/**
 * Campaign Types - Shared types for marketing campaigns
 */

export type CampaignType = 'push' | 'email' | 'sms' | 'whatsapp';
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
export type AudienceType = 'all' | 'segment' | 'custom';
export type AudienceSegment = 'new' | 'returning' | 'vip' | 'inactive' | 'birthday';
export type ScheduleType = 'immediate' | 'scheduled' | 'recurring';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';

export interface CampaignContent {
  title: string;
  body: string;
  image?: string;
  actionUrl?: string;
  htmlTemplate?: string;
  templateId?: string;
}

export interface CustomFilters {
  lastVisitDaysAgo?: { min?: number; max?: number };
  totalVisits?: { min?: number; max?: number };
  totalSpent?: { min?: number; max?: number };
  services?: string[];
  staff?: string[];
}

export interface CampaignAudience {
  type: AudienceType;
  segment?: AudienceSegment;
  customFilters?: CustomFilters;
  clientIds?: string[];
}

export interface RecurringSchedule {
  frequency: RecurringFrequency;
  daysOfWeek?: number[];
  time: string;
}

export interface CampaignSchedule {
  type: ScheduleType;
  sendAt?: string;
  recurring?: RecurringSchedule;
}

export interface CampaignStats {
  totalRecipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
}

export interface Campaign {
  _id: string;
  businessId: string;
  name: string;
  type: CampaignType;
  content: CampaignContent;
  audience: CampaignAudience;
  schedule: CampaignSchedule;
  stats: CampaignStats;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}

// API Request Types
export interface CreateCampaignRequest {
  name: string;
  type: CampaignType;
  content: CampaignContent;
  audience: CampaignAudience;
  schedule: CampaignSchedule;
}

export interface UpdateCampaignRequest {
  name?: string;
  content?: Partial<CampaignContent>;
  audience?: Partial<CampaignAudience>;
  schedule?: Partial<CampaignSchedule>;
}

export interface SendCampaignRequest {
  campaignId: string;
}

// Auto-notification settings
export interface AutoNotificationSettings {
  confirmationEnabled: boolean;
  reminder24hEnabled: boolean;
  reminder2hEnabled: boolean;
  reviewRequestEnabled: boolean;
  reviewRequestDelayHours: number;
  birthdayEnabled: boolean;
  birthdayMessage?: string;
  inactiveClientEnabled: boolean;
  inactiveClientDays: number;
  inactiveClientMessage?: string;
}

export interface UpdateAutoNotificationSettingsRequest extends Partial<AutoNotificationSettings> {}
