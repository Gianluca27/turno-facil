/**
 * Appointment Types - Shared types for appointments/bookings
 */

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type AppointmentSource = 'app_client' | 'app_business' | 'manual' | 'api';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'mercadopago' | 'transfer';
export type ReminderType = 'confirmation' | '24h' | '2h' | 'custom';
export type ReminderChannel = 'push' | 'sms' | 'email' | 'whatsapp';
export type ReminderStatus = 'sent' | 'delivered' | 'failed';
export type RecurrencePattern = 'weekly' | 'biweekly' | 'monthly';
export type CancelledBy = 'client' | 'business';

export interface ClientInfo {
  name: string;
  phone: string;
  email?: string;
}

export interface StaffInfo {
  name: string;
}

export interface AppointmentService {
  serviceId: string;
  name: string;
  duration: number;
  price: number;
  discount: number;
}

export interface AppointmentPricing {
  subtotal: number;
  discount: number;
  discountCode?: string;
  deposit: number;
  depositPaid: boolean;
  total: number;
  tip: number;
  finalTotal: number;
}

export interface StatusHistoryEntry {
  status: AppointmentStatus;
  changedAt: string;
  changedBy?: string;
  reason?: string;
}

export interface Cancellation {
  cancelledAt: string;
  cancelledBy: CancelledBy;
  reason?: string;
  refunded: boolean;
  refundAmount: number;
}

export interface AppointmentPayment {
  status: PaymentStatus;
  method?: PaymentMethod;
  transactionId?: string;
  paidAt?: string;
  paidAmount: number;
}

export interface AppointmentNotes {
  client?: string;
  business?: string;
  staff?: string;
}

export interface ReminderSent {
  type: ReminderType;
  channel: ReminderChannel;
  sentAt: string;
  status: ReminderStatus;
}

export interface AppointmentReview {
  submitted: boolean;
  requestedAt?: string;
}

export interface Recurrence {
  isRecurring: boolean;
  parentId?: string;
  pattern?: RecurrencePattern;
  endsAt?: string;
}

export interface Appointment {
  _id: string;
  businessId: string;
  clientId?: string;
  clientInfo: ClientInfo;
  staffId: string;
  staffInfo: StaffInfo;
  services: AppointmentService[];
  date: string;
  startTime: string;
  endTime: string;
  startDateTime: string;
  endDateTime: string;
  totalDuration: number;
  pricing: AppointmentPricing;
  status: AppointmentStatus;
  statusHistory: StatusHistoryEntry[];
  cancellation?: Cancellation;
  payment: AppointmentPayment;
  notes: AppointmentNotes;
  reminders: ReminderSent[];
  review: AppointmentReview;
  source: AppointmentSource;
  recurrence: Recurrence;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  // Populated fields
  business?: {
    _id: string;
    name: string;
    slug: string;
    media?: { logo?: string };
    location?: { address: string; city: string };
    contact?: { phone: string; whatsapp?: string };
  };
  staff?: {
    _id: string;
    profile: { firstName: string; lastName: string; avatar?: string };
  };
}

// API Request Types
export interface CreateAppointmentRequest {
  businessId: string;
  serviceIds: string[];
  staffId: string;
  date: string;
  startTime: string;
  notes?: string;
  discountCode?: string;
}

export interface RescheduleAppointmentRequest {
  date: string;
  startTime: string;
}

export interface CancelAppointmentRequest {
  reason?: string;
}

export interface CheckAvailabilityRequest {
  businessId: string;
  serviceIds: string[];
  staffId?: string;
  date: string;
}

export interface CalculatePriceRequest {
  businessId: string;
  serviceIds: string[];
  discountCode?: string;
}

// Business-side appointment requests
export interface CreateManualAppointmentRequest {
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  serviceIds: string[];
  staffId: string;
  date: string;
  startTime: string;
  notes?: string;
}

export interface UpdateAppointmentRequest {
  staffId?: string;
  date?: string;
  startTime?: string;
  notes?: string;
}

export interface CompleteAppointmentRequest {
  paymentMethod: PaymentMethod;
  paidAmount: number;
  tip?: number;
}

// Response types
export interface AvailabilitySlot {
  time: string;
  available: boolean;
  staffId?: string;
  staffName?: string;
}

export interface AvailabilityResponse {
  date: string;
  slots: AvailabilitySlot[];
}

export interface PriceCalculation {
  subtotal: number;
  discount: number;
  discountCode?: string;
  deposit: number;
  total: number;
}
