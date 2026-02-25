import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPromotionConditions {
  minPurchase?: number;
  services?: mongoose.Types.ObjectId[];
  staff?: mongoose.Types.ObjectId[];
  daysOfWeek?: number[];
  timeRange?: { from: string; to: string };
  firstVisitOnly?: boolean;
  minVisits?: number;
  clientSegment?: 'all' | 'new' | 'returning' | 'vip' | 'inactive';
}

export interface IPromotionLimits {
  totalUses?: number;
  usesPerClient?: number;
  currentUses: number;
}

export interface IPromotion extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed' | 'first_visit' | 'loyalty' | 'package';
  code?: string;
  discount: { type: 'percentage' | 'fixed'; amount: number; maxDiscount?: number };
  conditions: IPromotionConditions;
  limits: IPromotionLimits;
  validFrom: Date;
  validUntil: Date;
  status: 'draft' | 'active' | 'paused' | 'expired' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

export interface IPromotionModel extends Model<IPromotion> {
  findActive(businessId: string): Promise<IPromotion[]>;
  findByCode(businessId: string, code: string): Promise<IPromotion | null>;
}

const promotionSchema = new Schema<IPromotion, IPromotionModel>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: String,
    type: { type: String, enum: ['percentage', 'fixed', 'first_visit', 'loyalty', 'package'], required: true },
    code: { type: String, uppercase: true, trim: true, sparse: true },
    discount: {
      type: { type: String, enum: ['percentage', 'fixed'], required: true },
      amount: { type: Number, required: true, min: 0 },
      maxDiscount: Number,
    },
    conditions: {
      minPurchase: Number,
      services: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
      staff: [{ type: Schema.Types.ObjectId, ref: 'Staff' }],
      daysOfWeek: [Number],
      timeRange: { from: String, to: String },
      firstVisitOnly: Boolean,
      minVisits: Number,
      clientSegment: { type: String, enum: ['all', 'new', 'returning', 'vip', 'inactive'], default: 'all' },
    },
    limits: {
      totalUses: Number,
      usesPerClient: Number,
      currentUses: { type: Number, default: 0 },
    },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    status: { type: String, enum: ['draft', 'active', 'paused', 'expired', 'deleted'], default: 'draft' },
  },
  { timestamps: true }
);

promotionSchema.index({ businessId: 1, status: 1 });
promotionSchema.index({ code: 1, businessId: 1 }, { unique: true, sparse: true });
promotionSchema.index({ validFrom: 1, validUntil: 1 });

promotionSchema.statics.findActive = function (businessId: string): Promise<IPromotion[]> {
  const now = new Date();
  return this.find({ businessId, status: 'active', validFrom: { $lte: now }, validUntil: { $gte: now } });
};

promotionSchema.statics.findByCode = function (businessId: string, code: string): Promise<IPromotion | null> {
  const now = new Date();
  return this.findOne({ businessId, code: code.toUpperCase(), status: 'active', validFrom: { $lte: now }, validUntil: { $gte: now } });
};

export const Promotion = (mongoose.models.Promotion as IPromotionModel) || mongoose.model<IPromotion, IPromotionModel>('Promotion', promotionSchema);
