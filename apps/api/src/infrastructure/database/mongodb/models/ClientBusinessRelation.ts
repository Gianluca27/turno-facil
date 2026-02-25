import mongoose, { Schema, Document } from 'mongoose';

export interface IClientInfo {
  customName?: string;
  tags: string[];
  notes?: string;
  allergies?: string[];
  preferences?: string;
}

export interface IClientStats {
  totalVisits: number;
  totalSpent: number;
  totalCancellations: number;
  totalNoShows: number;
  lastVisit?: Date;
  averageSpent: number;
  favoriteServices: Array<{ serviceId: mongoose.Types.ObjectId; count: number }>;
  favoriteStaff?: mongoose.Types.ObjectId;
}

export interface IClientLoyalty {
  points: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  tierUpdatedAt: Date;
}

export interface ICommunicationPreferences {
  allowMarketing: boolean;
  allowReminders: boolean;
  preferredChannel: 'push' | 'sms' | 'email' | 'whatsapp';
}

export interface IClientBusinessRelation extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  clientInfo: IClientInfo;
  stats: IClientStats;
  loyalty: IClientLoyalty;
  isBlocked: boolean;
  blockedAt?: Date;
  blockedReason?: string;
  communicationPreferences: ICommunicationPreferences;
  createdAt: Date;
  updatedAt: Date;
}

const clientBusinessRelationSchema = new Schema<IClientBusinessRelation>(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    clientInfo: {
      customName: String,
      tags: { type: [String], default: [] },
      notes: String,
      allergies: [String],
      preferences: String,
    },
    stats: {
      totalVisits: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 },
      totalCancellations: { type: Number, default: 0 },
      totalNoShows: { type: Number, default: 0 },
      lastVisit: Date,
      averageSpent: { type: Number, default: 0 },
      favoriteServices: [{ serviceId: Schema.Types.ObjectId, count: Number }],
      favoriteStaff: Schema.Types.ObjectId,
    },
    loyalty: {
      points: { type: Number, default: 0 },
      tier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
      tierUpdatedAt: { type: Date, default: Date.now },
    },
    isBlocked: { type: Boolean, default: false },
    blockedAt: Date,
    blockedReason: String,
    communicationPreferences: {
      allowMarketing: { type: Boolean, default: true },
      allowReminders: { type: Boolean, default: true },
      preferredChannel: { type: String, enum: ['push', 'sms', 'email', 'whatsapp'], default: 'push' },
    },
  },
  { timestamps: true }
);

clientBusinessRelationSchema.index({ clientId: 1, businessId: 1 }, { unique: true });
clientBusinessRelationSchema.index({ businessId: 1, 'stats.lastVisit': -1 });
clientBusinessRelationSchema.index({ businessId: 1, 'loyalty.tier': 1 });
clientBusinessRelationSchema.index({ businessId: 1, isBlocked: 1 });

export const ClientBusinessRelation = (mongoose.models.ClientBusinessRelation as mongoose.Model<IClientBusinessRelation>) || mongoose.model<IClientBusinessRelation>('ClientBusinessRelation', clientBusinessRelationSchema);
