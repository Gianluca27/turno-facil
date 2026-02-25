import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWaitlistPreferences {
  services: mongoose.Types.ObjectId[];
  staffId?: mongoose.Types.ObjectId;
  dateRange?: { from: Date; to: Date };
  timeRange?: { from: string; to: string };
  daysOfWeek?: number[];
}

export interface IWaitlistNotification {
  appointmentId: mongoose.Types.ObjectId;
  sentAt: Date;
  expiresAt: Date;
  status: 'sent' | 'accepted' | 'expired' | 'declined';
}

export interface IWaitlist extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  preferences: IWaitlistPreferences;
  priority: 'normal' | 'vip';
  position: number;
  notifications: IWaitlistNotification[];
  status: 'active' | 'fulfilled' | 'cancelled' | 'expired';
  createdAt: Date;
  expiresAt: Date;
}

export interface IWaitlistModel extends Model<IWaitlist> {
  findActive(businessId: string): Promise<IWaitlist[]>;
}

const waitlistSchema = new Schema<IWaitlist, IWaitlistModel>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    preferences: {
      services: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
      staffId: { type: Schema.Types.ObjectId, ref: 'Staff' },
      dateRange: { from: Date, to: Date },
      timeRange: { from: String, to: String },
      daysOfWeek: [Number],
    },
    priority: { type: String, enum: ['normal', 'vip'], default: 'normal' },
    position: { type: Number, default: 0 },
    notifications: [{
      appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
      sentAt: Date,
      expiresAt: Date,
      status: { type: String, enum: ['sent', 'accepted', 'expired', 'declined'], default: 'sent' },
    }],
    status: { type: String, enum: ['active', 'fulfilled', 'cancelled', 'expired'], default: 'active' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

waitlistSchema.index({ businessId: 1, status: 1, priority: -1, createdAt: 1 });
waitlistSchema.index({ clientId: 1, status: 1 });
waitlistSchema.index({ expiresAt: 1 });

waitlistSchema.statics.findActive = function (businessId: string): Promise<IWaitlist[]> {
  return this.find({ businessId, status: 'active' })
    .populate('clientId', 'profile.firstName profile.lastName phone')
    .sort({ priority: -1, createdAt: 1 });
};

export const Waitlist = (mongoose.models.Waitlist as IWaitlistModel) || mongoose.model<IWaitlist, IWaitlistModel>('Waitlist', waitlistSchema);
