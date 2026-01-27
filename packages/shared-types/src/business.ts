/**
 * Business Types - Shared types for business entities
 */

export type BusinessStatus = 'pending' | 'active' | 'suspended' | 'deleted';
export type SubscriptionPlan = 'free' | 'basic' | 'professional' | 'enterprise';
export type SubscriptionStatus = 'active' | 'trial' | 'past_due' | 'cancelled';
export type PaymentMethodAccepted = 'cash' | 'card' | 'mercadopago' | 'transfer';
export type DepositType = 'percentage' | 'fixed';
export type PenaltyType = 'none' | 'percentage' | 'fixed';
export type TeamRole = 'owner' | 'admin' | 'manager' | 'staff' | 'receptionist';

export interface SocialMedia {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}

export interface Contact {
  email: string;
  phone: string;
  whatsapp?: string;
  website?: string;
  socialMedia?: SocialMedia;
}

export interface Coordinates {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface Location {
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  coordinates: Coordinates;
  placeId?: string;
}

export interface GalleryItem {
  _id: string;
  url: string;
  thumbnail?: string;
  caption?: string;
  order: number;
}

export interface BusinessMedia {
  logo?: string;
  cover?: string;
  gallery: GalleryItem[];
}

export interface TimeSlot {
  open: string; // "09:00"
  close: string; // "18:00"
}

export interface ScheduleDay {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  isOpen: boolean;
  slots: TimeSlot[];
}

export interface ScheduleException {
  _id?: string;
  date: string;
  isOpen: boolean;
  slots: TimeSlot[];
  reason?: string;
}

export interface BusinessSchedule {
  timezone: string;
  regular: ScheduleDay[];
  exceptions: ScheduleException[];
}

export interface CancellationPolicy {
  allowCancellation: boolean;
  hoursBeforeAppointment: number;
  penaltyType: PenaltyType;
  penaltyAmount: number;
}

export interface BookingConfig {
  slotDuration: number;
  bufferTime: number;
  maxSimultaneous: number;
  minAdvance: number; // hours
  maxAdvance: number; // days
  allowInstantBooking: boolean;
  requireConfirmation: boolean;
  cancellationPolicy: CancellationPolicy;
  requireDeposit: boolean;
  depositAmount: number;
  depositType: DepositType;
  maxBookingsPerClient: number;
  allowWaitlist: boolean;
}

export interface PaymentConfig {
  acceptedMethods: PaymentMethodAccepted[];
  mercadoPagoAccountId?: string;
  requirePaymentOnBooking: boolean;
}

export interface ServiceCategory {
  _id: string;
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface BusinessStats {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShows: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
  totalClients: number;
}

export interface ReviewConfig {
  allowReviews: boolean;
  requireVerifiedVisit: boolean;
  autoRequestAfterHours: number;
}

export interface Subscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  mercadoPagoSubscriptionId?: string;
}

export interface TeamMember {
  userId: string;
  role: TeamRole;
  permissions: string[];
  invitedAt?: string;
  joinedAt?: string;
  status?: string;
}

export interface PendingInvitation {
  _id?: string;
  email: string;
  role: string;
  permissions: string[];
  invitedBy: string;
  invitedAt: string;
  status: string;
  token: string;
}

export interface GoogleCalendarIntegration {
  connected: boolean;
  connectedAt?: string;
  calendarId?: string;
  syncEnabled?: boolean;
}

export interface MercadoPagoIntegration {
  connected: boolean;
  connectedAt?: string;
  publicKey?: string;
  userId?: string;
}

export interface BusinessIntegrations {
  googleCalendar?: GoogleCalendarIntegration;
  mercadoPago?: MercadoPagoIntegration;
}

export interface Business {
  _id: string;
  name: string;
  slug: string;
  type: string;
  description?: string;
  contact: Contact;
  location: Location;
  media: BusinessMedia;
  schedule: BusinessSchedule;
  bookingConfig: BookingConfig;
  paymentConfig: PaymentConfig;
  serviceCategories: ServiceCategory[];
  stats: BusinessStats;
  reviewConfig: ReviewConfig;
  subscription: Subscription;
  ownerId: string;
  status: BusinessStatus;
  team?: TeamMember[];
  pendingInvitations?: PendingInvitation[];
  integrations?: BusinessIntegrations;
  webhookUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// API Request Types
export interface CreateBusinessRequest {
  name: string;
  type: string;
  description?: string;
  contact: Omit<Contact, 'socialMedia'> & { socialMedia?: SocialMedia };
  location: Omit<Location, 'coordinates'> & {
    latitude: number;
    longitude: number;
  };
}

export interface UpdateBusinessRequest {
  name?: string;
  type?: string;
  description?: string;
  contact?: Partial<Contact>;
}

export interface UpdateScheduleRequest {
  timezone?: string;
  regular?: ScheduleDay[];
  exceptions?: ScheduleException[];
}

export interface UpdateBookingConfigRequest {
  slotDuration?: number;
  bufferTime?: number;
  maxSimultaneous?: number;
  minAdvance?: number;
  maxAdvance?: number;
  allowInstantBooking?: boolean;
  requireConfirmation?: boolean;
  cancellationPolicy?: Partial<CancellationPolicy>;
  requireDeposit?: boolean;
  depositAmount?: number;
  depositType?: DepositType;
  maxBookingsPerClient?: number;
  allowWaitlist?: boolean;
}

export interface InviteTeamMemberRequest {
  email: string;
  role: TeamRole;
  permissions?: string[];
}

// Public business info (for client app)
export interface BusinessPublicInfo {
  _id: string;
  name: string;
  slug: string;
  type: string;
  description?: string;
  contact: Contact;
  location: Location;
  media: BusinessMedia;
  schedule: BusinessSchedule;
  stats: Pick<BusinessStats, 'averageRating' | 'totalReviews'>;
  serviceCategories: ServiceCategory[];
  bookingConfig: Pick<
    BookingConfig,
    'slotDuration' | 'minAdvance' | 'maxAdvance' | 'allowWaitlist' | 'requireDeposit' | 'depositAmount' | 'depositType'
  >;
}
