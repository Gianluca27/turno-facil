import mongoose, { Schema, Document, Model } from 'mongoose';

// Interfaces
export interface IServiceConfig {
  bufferAfter: number;
  maxPerDay?: number;
  requiresDeposit: boolean;
  depositAmount: number;
  allowOnlineBooking: boolean;
}

export interface IServiceAvailability {
  allDays: boolean;
  specificDays: number[];
  specificHours?: {
    start: string;
    end: string;
  }[];
}

export interface IPackageService {
  serviceId: mongoose.Types.ObjectId;
  quantity: number;
}

export interface IServiceDiscount {
  isActive: boolean;
  type: 'percentage' | 'fixed';
  amount: number;
  validFrom?: Date;
  validUntil?: Date;
}

export interface IServiceStats {
  totalBookings: number;
  totalRevenue: number;
}

export interface IService extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  categoryId?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  duration: number;
  price: number;
  currency: string;
  config: IServiceConfig;
  availability: IServiceAvailability;
  image?: string;
  gallery: string[];
  isPackage: boolean;
  packageServices: IPackageService[];
  discount: IServiceDiscount;
  stats: IServiceStats;
  order: number;
  status: 'active' | 'inactive' | 'deleted';
  createdAt: Date;
  updatedAt: Date;

  // Virtuals
  finalPrice: number;
}

export interface IServiceModel extends Model<IService> {
  findByBusiness(businessId: string | mongoose.Types.ObjectId): Promise<IService[]>;
  findActiveByBusiness(businessId: string | mongoose.Types.ObjectId): Promise<IService[]>;
  findByCategory(
    businessId: string | mongoose.Types.ObjectId,
    categoryId: string | mongoose.Types.ObjectId
  ): Promise<IService[]>;
}

// Schema
const serviceSchema = new Schema<IService, IServiceModel>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    duration: {
      type: Number,
      required: true,
      min: 5,
      max: 480, // 8 hours max
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'ARS',
      uppercase: true,
    },
    config: {
      bufferAfter: {
        type: Number,
        default: 0,
        min: 0,
      },
      maxPerDay: {
        type: Number,
        min: 1,
      },
      requiresDeposit: {
        type: Boolean,
        default: false,
      },
      depositAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
      allowOnlineBooking: {
        type: Boolean,
        default: true,
      },
    },
    availability: {
      allDays: {
        type: Boolean,
        default: true,
      },
      specificDays: {
        type: [Number],
        default: [],
        validate: {
          validator: (v: number[]) => v.every((d) => d >= 0 && d <= 6),
          message: 'Days must be between 0 and 6',
        },
      },
      specificHours: [
        {
          start: String,
          end: String,
        },
      ],
    },
    image: String,
    gallery: {
      type: [String],
      default: [],
    },
    isPackage: {
      type: Boolean,
      default: false,
    },
    packageServices: [
      {
        serviceId: {
          type: Schema.Types.ObjectId,
          ref: 'Service',
          required: true,
        },
        quantity: {
          type: Number,
          default: 1,
          min: 1,
        },
      },
    ],
    discount: {
      isActive: {
        type: Boolean,
        default: false,
      },
      type: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage',
      },
      amount: {
        type: Number,
        default: 0,
        min: 0,
      },
      validFrom: Date,
      validUntil: Date,
    },
    stats: {
      totalBookings: {
        type: Number,
        default: 0,
      },
      totalRevenue: {
        type: Number,
        default: 0,
      },
    },
    order: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'deleted'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
serviceSchema.index({ businessId: 1, status: 1 });
serviceSchema.index({ businessId: 1, categoryId: 1 });
serviceSchema.index({ 'discount.isActive': 1 });
serviceSchema.index({ businessId: 1, name: 'text' });

// Virtual for final price (with discount applied)
serviceSchema.virtual('finalPrice').get(function (this: IService): number {
  if (!this.discount.isActive) {
    return this.price;
  }

  // Check if discount is within valid dates
  const now = new Date();
  if (this.discount.validFrom && now < this.discount.validFrom) {
    return this.price;
  }
  if (this.discount.validUntil && now > this.discount.validUntil) {
    return this.price;
  }

  if (this.discount.type === 'percentage') {
    return this.price - (this.price * this.discount.amount) / 100;
  }

  return Math.max(0, this.price - this.discount.amount);
});

// Static methods
serviceSchema.statics.findByBusiness = function (
  businessId: string | mongoose.Types.ObjectId
): Promise<IService[]> {
  return this.find({
    businessId,
    status: { $ne: 'deleted' },
  }).sort({ order: 1, name: 1 });
};

serviceSchema.statics.findActiveByBusiness = function (
  businessId: string | mongoose.Types.ObjectId
): Promise<IService[]> {
  return this.find({
    businessId,
    status: 'active',
  }).sort({ order: 1, name: 1 });
};

serviceSchema.statics.findByCategory = function (
  businessId: string | mongoose.Types.ObjectId,
  categoryId: string | mongoose.Types.ObjectId
): Promise<IService[]> {
  return this.find({
    businessId,
    categoryId,
    status: 'active',
  }).sort({ order: 1, name: 1 });
};

export const Service = mongoose.model<IService, IServiceModel>('Service', serviceSchema);
