import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICampaignContent {
  title: string;
  body: string;
  image?: string;
  actionUrl?: string;
  htmlTemplate?: string;
  templateId?: string;
}

export interface ICampaignAudience {
  type: 'all' | 'segment' | 'custom';
  segment?: 'new' | 'returning' | 'vip' | 'inactive' | 'birthday';
  customFilters?: {
    lastVisitDaysAgo?: { min?: number; max?: number };
    totalVisits?: { min?: number; max?: number };
    totalSpent?: { min?: number; max?: number };
    services?: mongoose.Types.ObjectId[];
    staff?: mongoose.Types.ObjectId[];
  };
  clientIds?: mongoose.Types.ObjectId[];
}

export interface ICampaignSchedule {
  type: 'immediate' | 'scheduled' | 'recurring';
  sendAt?: Date;
  recurring?: { frequency: 'daily' | 'weekly' | 'monthly'; daysOfWeek?: number[]; time: string };
}

export interface ICampaignStats {
  totalRecipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
}

export interface ICampaign extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  name: string;
  type: 'push' | 'email' | 'sms' | 'whatsapp';
  content: ICampaignContent;
  audience: ICampaignAudience;
  schedule: ICampaignSchedule;
  stats: ICampaignStats;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
}

export interface ICampaignModel extends Model<ICampaign> {}

const campaignSchema = new Schema<ICampaign, ICampaignModel>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['push', 'email', 'sms', 'whatsapp'], required: true },
    content: {
      title: { type: String, required: true },
      body: { type: String, required: true },
      image: String,
      actionUrl: String,
      htmlTemplate: String,
      templateId: String,
    },
    audience: {
      type: { type: String, enum: ['all', 'segment', 'custom'], required: true },
      segment: { type: String, enum: ['new', 'returning', 'vip', 'inactive', 'birthday'] },
      customFilters: {
        lastVisitDaysAgo: { min: Number, max: Number },
        totalVisits: { min: Number, max: Number },
        totalSpent: { min: Number, max: Number },
        services: [Schema.Types.ObjectId],
        staff: [Schema.Types.ObjectId],
      },
      clientIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    },
    schedule: {
      type: { type: String, enum: ['immediate', 'scheduled', 'recurring'], required: true },
      sendAt: Date,
      recurring: { frequency: String, daysOfWeek: [Number], time: String },
    },
    stats: {
      totalRecipients: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    status: { type: String, enum: ['draft', 'scheduled', 'sending', 'sent', 'cancelled'], default: 'draft' },
    sentAt: Date,
  },
  { timestamps: true }
);

campaignSchema.index({ businessId: 1, status: 1 });
campaignSchema.index({ 'schedule.sendAt': 1, status: 1 });

export const Campaign = mongoose.model<ICampaign, ICampaignModel>('Campaign', campaignSchema);
