import mongoose, { Schema, Document, Model } from 'mongoose';

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_reminder'
  | 'booking_rescheduled'
  | 'review_request'
  | 'promotion'
  | 'message'
  | 'payment_received'
  | 'payment_failed'
  | 'waitlist_available'
  | 'birthday'
  | 'new_booking'
  | 'daily_summary'
  | 'general';

export type NotificationStatus = 'pending' | 'sent' | 'partial' | 'failed';

export interface IDeliveryResult {
  channel: 'push' | 'email' | 'sms';
  success: boolean;
  error?: string;
  messageId?: string;
  sentAt?: Date;
}

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userType: 'user' | 'business_user';
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  businessId?: mongoose.Types.ObjectId;
  appointmentId?: mongoose.Types.ObjectId;
  channels: ('push' | 'email' | 'sms')[];
  status: NotificationStatus;
  deliveryResults?: IDeliveryResult[];
  read: boolean;
  readAt?: Date;
  sentAt?: Date;
  scheduledFor?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationModel extends Model<INotification> {
  findUnread(userType: string, userId: string, limit?: number): Promise<INotification[]>;
  markAsRead(notificationId: string): Promise<INotification | null>;
  markAllAsRead(userType: string, userId: string): Promise<{ modifiedCount: number }>;
  getUnreadCount(userType: string, userId: string): Promise<number>;
}

const deliveryResultSchema = new Schema(
  {
    channel: {
      type: String,
      enum: ['push', 'email', 'sms'],
      required: true,
    },
    success: {
      type: Boolean,
      required: true,
    },
    error: String,
    messageId: String,
    sentAt: Date,
  },
  { _id: false }
);

const notificationSchema = new Schema<INotification, INotificationModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    userType: {
      type: String,
      enum: ['user', 'business_user'],
      default: 'user',
    },
    type: {
      type: String,
      enum: [
        'booking_confirmed',
        'booking_cancelled',
        'booking_reminder',
        'booking_rescheduled',
        'review_request',
        'promotion',
        'message',
        'payment_received',
        'payment_failed',
        'waitlist_available',
        'birthday',
        'new_booking',
        'daily_summary',
        'general',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      index: true,
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    channels: [{
      type: String,
      enum: ['push', 'email', 'sms'],
    }],
    status: {
      type: String,
      enum: ['pending', 'sent', 'partial', 'failed'],
      default: 'pending',
    },
    deliveryResults: [deliveryResultSchema],
    read: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    sentAt: Date,
    scheduledFor: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for common queries
notificationSchema.index({ userId: 1, userType: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, userType: 1, createdAt: -1 });
notificationSchema.index({ scheduledFor: 1, status: 1 });
notificationSchema.index({ businessId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL

// Static methods
notificationSchema.statics.findUnread = function (
  userType: string,
  userId: string,
  limit: number = 50
): Promise<INotification[]> {
  return this.find({
    userType,
    userId,
    read: false,
    status: { $in: ['sent', 'partial'] },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

notificationSchema.statics.markAsRead = function (
  notificationId: string
): Promise<INotification | null> {
  return this.findByIdAndUpdate(
    notificationId,
    { read: true, readAt: new Date() },
    { new: true }
  );
};

notificationSchema.statics.markAllAsRead = function (
  userType: string,
  userId: string
): Promise<{ modifiedCount: number }> {
  return this.updateMany(
    { userType, userId, read: false },
    { read: true, readAt: new Date() }
  );
};

notificationSchema.statics.getUnreadCount = function (
  userType: string,
  userId: string
): Promise<number> {
  return this.countDocuments({
    userType,
    userId,
    read: false,
    status: { $in: ['sent', 'partial'] },
  });
};

export const Notification = mongoose.model<INotification, INotificationModel>(
  'Notification',
  notificationSchema
);
