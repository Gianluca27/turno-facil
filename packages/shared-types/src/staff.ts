/**
 * Staff Types - Shared types for business staff/professionals
 */

export type StaffStatus = 'active' | 'inactive' | 'vacation' | 'deleted';
export type ExceptionType = 'vacation' | 'sick' | 'personal' | 'other';
export type RecurringFrequency = 'weekly' | 'monthly';

export interface StaffProfile {
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  specialties?: string[];
}

export interface StaffContact {
  email?: string;
  phone?: string;
}

export interface StaffScheduleSlot {
  start: string;
  end: string;
}

export interface StaffScheduleDay {
  dayOfWeek: number; // 0-6
  isAvailable: boolean;
  slots: StaffScheduleSlot[];
}

export interface RecurringPattern {
  frequency: RecurringFrequency;
  daysOfWeek?: number[];
}

export interface StaffException {
  _id: string;
  startDate: string;
  endDate: string;
  type: ExceptionType;
  reason?: string;
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
}

export interface StaffSchedule {
  useBusinessSchedule: boolean;
  custom?: StaffScheduleDay[];
}

export interface StaffConfig {
  bufferTime?: number;
  maxDailyAppointments?: number;
  acceptsNewClients: boolean;
}

export interface StaffStats {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
}

export interface Staff {
  _id: string;
  businessId: string;
  userId?: string;
  profile: StaffProfile;
  contact: StaffContact;
  services: string[];
  schedule: StaffSchedule;
  exceptions: StaffException[];
  config: StaffConfig;
  stats: StaffStats;
  order: number;
  status: StaffStatus;
  createdAt: string;
  updatedAt: string;
}

// API Request Types
export interface CreateStaffRequest {
  firstName: string;
  lastName: string;
  displayName?: string;
  bio?: string;
  specialties?: string[];
  email?: string;
  phone?: string;
  services?: string[];
  useBusinessSchedule?: boolean;
}

export interface UpdateStaffRequest {
  profile?: Partial<StaffProfile>;
  contact?: Partial<StaffContact>;
  services?: string[];
  config?: Partial<StaffConfig>;
  order?: number;
  status?: StaffStatus;
}

export interface UpdateStaffScheduleRequest {
  useBusinessSchedule: boolean;
  custom?: StaffScheduleDay[];
}

export interface CreateExceptionRequest {
  startDate: string;
  endDate: string;
  type: ExceptionType;
  reason?: string;
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern;
}

export interface AssignServicesRequest {
  serviceIds: string[];
}

// Public staff info (for client app)
export interface StaffPublicInfo {
  _id: string;
  profile: {
    firstName: string;
    lastName: string;
    displayName?: string;
    avatar?: string;
    bio?: string;
    specialties?: string[];
  };
  stats: {
    averageRating: number;
    totalReviews: number;
  };
  services: string[];
}
