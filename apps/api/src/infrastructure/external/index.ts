// Twilio - SMS and OTP verification
export { twilioService } from './twilio/index.js';
export type { SendSMSParams, SendOTPParams, VerifyOTPParams, SMSResult, OTPResult } from './twilio/index.js';

// SendGrid - Email service
export { sendGridService } from './sendgrid/index.js';
export type {
  EmailParams,
  TemplateEmailParams,
  EmailResult,
  BookingConfirmedData,
  BookingCancelledData,
  ReminderData,
  PasswordResetData,
  WelcomeData,
  ReviewRequestData
} from './sendgrid/index.js';

// Firebase - Push notifications
export { firebaseService } from './firebase/index.js';
export type {
  PushNotificationParams,
  MulticastParams,
  TopicNotificationParams,
  PushResult
} from './firebase/index.js';

// AWS S3 - File storage
export { s3Service } from './s3/index.js';
export type {
  BucketType,
  UploadParams,
  SignedUrlParams,
  ImageProcessingOptions,
  UploadResult,
  SignedUrlResult
} from './s3/index.js';

// MercadoPago - Payment processing
export { mercadoPagoService } from './mercadopago/index.js';
export type {
  CreatePaymentParams,
  CreatePreferenceParams,
  CreateSubscriptionPlanParams,
  CreateSubscriptionParams,
  RefundParams,
  PaymentResult,
  PreferenceResult,
  SubscriptionPlanResult,
  SubscriptionResult,
  RefundResult,
  WebhookPayload
} from './mercadopago/index.js';

// Google - OAuth and Maps
export { googleService } from './google/index.js';
export type {
  GoogleUserInfo,
  VerifyTokenResult as GoogleVerifyTokenResult,
  GeocodingResult,
  ReverseGeocodingResult,
  PlaceAutocompleteResult,
  PlaceDetailsResult,
  DistanceMatrixResult
} from './google/index.js';
