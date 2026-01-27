/**
 * Notification Types - Shared types for notifications
 */

export type RecipientType = 'user' | 'business_user';

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'review_request'
  | 'promotion'
  | 'message'
  | 'payment_received'
  | 'waitlist_available'
  | 'birthday'
  | 'new_booking'
  | 'cancelled_by_client'
  | 'new_review'
  | 'daily_summary';

export type ChannelStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface PushChannelInfo {
  sent: boolean;
  sentAt?: string;
  fcmMessageId?: string;
  status: ChannelStatus;
}

export interface EmailChannelInfo {
  sent: boolean;
  sentAt?: string;
  messageId?: string;
  status: ChannelStatus;
}

export interface SmsChannelInfo {
  sent: boolean;
  sentAt?: string;
  sid?: string;
  status: ChannelStatus;
}

export interface NotificationChannels {
  push?: PushChannelInfo;
  email?: EmailChannelInfo;
  sms?: SmsChannelInfo;
}

export interface Notification {
  _id: string;
  recipientType: RecipientType;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  businessId?: string;
  appointmentId?: string;
  channels: NotificationChannels;
  read: boolean;
  readAt?: string;
  scheduledFor?: string;
  createdAt: string;
}

// API Request Types
export interface MarkNotificationReadRequest {
  notificationId: string;
}

export interface UpdateNotificationSettingsRequest {
  push?: boolean;
  email?: boolean;
  sms?: boolean;
  marketing?: boolean;
  newBooking?: boolean;
  cancellation?: boolean;
  reminder?: boolean;
}

// Push notification payload
export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: {
    type: NotificationType;
    appointmentId?: string;
    businessId?: string;
    [key: string]: unknown;
  };
}
