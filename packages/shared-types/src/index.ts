/**
 * TurnoFácil Shared Types
 *
 * This package contains all shared TypeScript types used across
 * the TurnoFácil platform (API, mobile-business, mobile-client).
 */

// User types (client app users)
export {
  type Gender,
  type UserStatus,
  type ThemePreference,
  type AuthProvider,
  type PaymentMethodType,
  type DevicePlatform,
  type AuthProviderInfo,
  type UserProfile,
  type NotificationPreferences,
  type UserPreferences,
  type PaymentMethod,
  type UserFavorites,
  type UserStats,
  type UserDevice,
  type User,
  type RegisterUserRequest,
  type LoginRequest,
  type PhoneLoginRequest,
  type VerifyOtpRequest,
  type SocialLoginRequest,
  type UpdateProfileRequest,
  type UpdatePreferencesRequest,
  type AuthResponse,
  type RefreshTokenResponse,
} from './user';

// Business types
export * from './business';

// Service types
export {
  type ServiceStatus,
  type DiscountType,
  type ServiceDiscount,
  type ServiceAvailability,
  type ServiceConfig,
  type PackageService,
  type ServiceStats,
  type Service,
  type CreateServiceRequest,
  type UpdateServiceRequest,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
  type ReorderCategoriesRequest,
  type SetServiceDiscountRequest,
} from './service';

// Staff types
export {
  type StaffStatus,
  type ExceptionType,
  type RecurringFrequency as StaffRecurringFrequency,
  type StaffProfile,
  type StaffContact,
  type StaffScheduleSlot,
  type StaffScheduleDay,
  type RecurringPattern as StaffRecurringPattern,
  type StaffException,
  type StaffSchedule,
  type StaffConfig,
  type StaffStats,
  type Staff,
  type CreateStaffRequest,
  type UpdateStaffRequest,
  type UpdateStaffScheduleRequest,
  type CreateExceptionRequest,
  type AssignServicesRequest,
  type StaffPublicInfo,
} from './staff';

// Appointment types
export {
  type AppointmentStatus,
  type AppointmentSource,
  type PaymentStatus,
  type PaymentMethod as AppointmentPaymentMethod,
  type ReminderType,
  type ReminderChannel,
  type ReminderStatus,
  type RecurrencePattern,
  type CancelledBy,
  type ClientInfo as AppointmentClientInfo,
  type StaffInfo as AppointmentStaffInfo,
  type AppointmentService,
  type AppointmentPricing,
  type StatusHistoryEntry,
  type Cancellation,
  type AppointmentPayment,
  type AppointmentNotes,
  type ReminderSent,
  type AppointmentReview,
  type Recurrence,
  type Appointment,
  type CreateAppointmentRequest,
  type RescheduleAppointmentRequest,
  type CancelAppointmentRequest,
  type CheckAvailabilityRequest,
  type CalculatePriceRequest,
  type CreateManualAppointmentRequest,
  type UpdateAppointmentRequest,
  type CompleteAppointmentRequest,
  type AvailabilitySlot,
  type AvailabilityResponse,
  type PriceCalculation,
} from './appointment';

// Review types
export * from './review';

// Notification types
export * from './notification';

// Waitlist types
export * from './waitlist';

// Promotion types
export * from './promotion';

// Transaction types
export * from './transaction';

// Client-business relationship types
export {
  type LoyaltyTier,
  type PreferredChannel,
  type ClientInfo,
  type FavoriteService,
  type ClientStats,
  type LoyaltyInfo,
  type CommunicationPreferences,
  type ClientBusinessRelation,
  type CreateClientRequest,
  type UpdateClientRequest,
  type BlockClientRequest,
  type SendMessageRequest,
  type AddNoteRequest,
  type ClientSearchResult,
  type ClientDetail,
} from './client';

// Campaign/Marketing types
export {
  type CampaignType,
  type CampaignStatus,
  type AudienceType,
  type AudienceSegment,
  type ScheduleType,
  type RecurringFrequency as CampaignRecurringFrequency,
  type CampaignContent,
  type CustomFilters,
  type CampaignAudience,
  type RecurringSchedule as CampaignRecurringSchedule,
  type CampaignSchedule,
  type CampaignStats,
  type Campaign,
  type CreateCampaignRequest,
  type UpdateCampaignRequest,
  type SendCampaignRequest,
  type AutoNotificationSettings,
  type UpdateAutoNotificationSettingsRequest,
} from './campaign';

// Common API types
export * from './api';
