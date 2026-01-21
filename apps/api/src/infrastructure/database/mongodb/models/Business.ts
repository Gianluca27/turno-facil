import mongoose, { Schema, Document, Model } from 'mongoose';
import slugify from 'slugify';

// Interfaces
export interface IContact {
  email: string;
  phone: string;
  whatsapp?: string;
  website?: string;
  socialMedia?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
  };
}

export interface ICoordinates {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ILocation {
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  coordinates: ICoordinates;
  placeId?: string;
}

export interface IGalleryItem {
  _id: mongoose.Types.ObjectId;
  url: string;
  thumbnail?: string;
  caption?: string;
  order: number;
}

export interface IMedia {
  logo?: string;
  cover?: string;
  gallery: IGalleryItem[];
}

export interface ITimeSlot {
  open: string; // "09:00"
  close: string; // "18:00"
}

export interface IScheduleDay {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  isOpen: boolean;
  slots: ITimeSlot[];
}

export interface IScheduleException {
  date: Date;
  isOpen: boolean;
  slots: ITimeSlot[];
  reason?: string;
}

export interface ISchedule {
  timezone: string;
  regular: IScheduleDay[];
  exceptions: IScheduleException[];
}

export interface ICancellationPolicy {
  allowCancellation: boolean;
  hoursBeforeAppointment: number;
  penaltyType: 'none' | 'percentage' | 'fixed';
  penaltyAmount: number;
}

export interface IBookingConfig {
  slotDuration: number;
  bufferTime: number;
  maxSimultaneous: number;
  minAdvance: number; // hours
  maxAdvance: number; // days
  allowInstantBooking: boolean;
  requireConfirmation: boolean;
  cancellationPolicy: ICancellationPolicy;
  requireDeposit: boolean;
  depositAmount: number;
  depositType: 'percentage' | 'fixed';
  maxBookingsPerClient: number;
  allowWaitlist: boolean;
}

export interface IPaymentConfig {
  acceptedMethods: ('cash' | 'card' | 'mercadopago' | 'transfer')[];
  mercadoPagoAccountId?: string;
  requirePaymentOnBooking: boolean;
}

export interface IServiceCategory {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  order: number;
  isActive: boolean;
}

export interface IBusinessStats {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShows: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
  totalClients: number;
}

export interface IReviewConfig {
  allowReviews: boolean;
  requireVerifiedVisit: boolean;
  autoRequestAfterHours: number;
}

export interface ISubscription {
  plan: 'free' | 'basic' | 'professional' | 'enterprise';
  status: 'active' | 'trial' | 'past_due' | 'cancelled';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  mercadoPagoSubscriptionId?: string;
}

export interface IBusiness extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  type: string;
  description?: string;
  contact: IContact;
  location: ILocation;
  media: IMedia;
  schedule: ISchedule;
  bookingConfig: IBookingConfig;
  paymentConfig: IPaymentConfig;
  serviceCategories: IServiceCategory[];
  stats: IBusinessStats;
  reviewConfig: IReviewConfig;
  subscription: ISubscription;
  ownerId: mongoose.Types.ObjectId;
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

export interface IBusinessModel extends Model<IBusiness> {
  findBySlug(slug: string): Promise<IBusiness | null>;
  findNearby(
    longitude: number,
    latitude: number,
    maxDistance: number
  ): Promise<IBusiness[]>;
}

// Schema
const businessSchema = new Schema<IBusiness, IBusinessModel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    contact: {
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      whatsapp: String,
      website: String,
      socialMedia: {
        instagram: String,
        facebook: String,
        tiktok: String,
      },
    },
    location: {
      address: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
        default: 'Argentina',
      },
      postalCode: String,
      coordinates: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
        },
        coordinates: {
          type: [Number],
          required: true,
          validate: {
            validator: (v: number[]) => v.length === 2,
            message: 'Coordinates must be [longitude, latitude]',
          },
        },
      },
      placeId: String,
    },
    media: {
      logo: String,
      cover: String,
      gallery: [
        {
          url: { type: String, required: true },
          thumbnail: String,
          caption: String,
          order: { type: Number, default: 0 },
        },
      ],
    },
    schedule: {
      timezone: {
        type: String,
        default: 'America/Argentina/Buenos_Aires',
      },
      regular: [
        {
          dayOfWeek: {
            type: Number,
            min: 0,
            max: 6,
            required: true,
          },
          isOpen: {
            type: Boolean,
            default: true,
          },
          slots: [
            {
              open: { type: String, required: true },
              close: { type: String, required: true },
            },
          ],
        },
      ],
      exceptions: [
        {
          date: { type: Date, required: true },
          isOpen: { type: Boolean, default: false },
          slots: [
            {
              open: String,
              close: String,
            },
          ],
          reason: String,
        },
      ],
    },
    bookingConfig: {
      slotDuration: { type: Number, default: 30 },
      bufferTime: { type: Number, default: 0 },
      maxSimultaneous: { type: Number, default: 1 },
      minAdvance: { type: Number, default: 1 }, // 1 hour
      maxAdvance: { type: Number, default: 30 }, // 30 days
      allowInstantBooking: { type: Boolean, default: true },
      requireConfirmation: { type: Boolean, default: false },
      cancellationPolicy: {
        allowCancellation: { type: Boolean, default: true },
        hoursBeforeAppointment: { type: Number, default: 24 },
        penaltyType: {
          type: String,
          enum: ['none', 'percentage', 'fixed'],
          default: 'none',
        },
        penaltyAmount: { type: Number, default: 0 },
      },
      requireDeposit: { type: Boolean, default: false },
      depositAmount: { type: Number, default: 0 },
      depositType: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage',
      },
      maxBookingsPerClient: { type: Number, default: 5 },
      allowWaitlist: { type: Boolean, default: true },
    },
    paymentConfig: {
      acceptedMethods: {
        type: [String],
        enum: ['cash', 'card', 'mercadopago', 'transfer'],
        default: ['cash'],
      },
      mercadoPagoAccountId: String,
      requirePaymentOnBooking: { type: Boolean, default: false },
    },
    serviceCategories: [
      {
        name: { type: String, required: true },
        description: String,
        order: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
      },
    ],
    stats: {
      totalAppointments: { type: Number, default: 0 },
      completedAppointments: { type: Number, default: 0 },
      cancelledAppointments: { type: Number, default: 0 },
      noShows: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
      totalClients: { type: Number, default: 0 },
    },
    reviewConfig: {
      allowReviews: { type: Boolean, default: true },
      requireVerifiedVisit: { type: Boolean, default: true },
      autoRequestAfterHours: { type: Number, default: 2 },
    },
    subscription: {
      plan: {
        type: String,
        enum: ['free', 'basic', 'professional', 'enterprise'],
        default: 'free',
      },
      status: {
        type: String,
        enum: ['active', 'trial', 'past_due', 'cancelled'],
        default: 'trial',
      },
      currentPeriodStart: { type: Date, default: Date.now },
      currentPeriodEnd: {
        type: Date,
        default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
      },
      mercadoPagoSubscriptionId: String,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'BusinessUser',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'deleted'],
      default: 'pending',
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
businessSchema.index({ 'location.coordinates': '2dsphere' });
businessSchema.index({ type: 1, status: 1 });
businessSchema.index({ 'stats.averageRating': -1 });
businessSchema.index({ status: 1, 'subscription.status': 1 });
businessSchema.index({ name: 'text', description: 'text' });

// Pre-save middleware to generate slug
businessSchema.pre('save', async function (next) {
  if (!this.isModified('name') && this.slug) {
    return next();
  }

  let slug = slugify(this.name, { lower: true, strict: true });
  let counter = 0;
  let uniqueSlug = slug;

  // Check for uniqueness and append number if needed
  while (await mongoose.models.Business.findOne({ slug: uniqueSlug, _id: { $ne: this._id } })) {
    counter++;
    uniqueSlug = `${slug}-${counter}`;
  }

  this.slug = uniqueSlug;
  next();
});

// Pre-save middleware to set default schedule
businessSchema.pre('save', function (next) {
  if (this.isNew && (!this.schedule.regular || this.schedule.regular.length === 0)) {
    // Default schedule: Monday-Friday 9am-6pm, Saturday 9am-1pm
    this.schedule.regular = [
      { dayOfWeek: 0, isOpen: false, slots: [] }, // Sunday
      { dayOfWeek: 1, isOpen: true, slots: [{ open: '09:00', close: '18:00' }] }, // Monday
      { dayOfWeek: 2, isOpen: true, slots: [{ open: '09:00', close: '18:00' }] }, // Tuesday
      { dayOfWeek: 3, isOpen: true, slots: [{ open: '09:00', close: '18:00' }] }, // Wednesday
      { dayOfWeek: 4, isOpen: true, slots: [{ open: '09:00', close: '18:00' }] }, // Thursday
      { dayOfWeek: 5, isOpen: true, slots: [{ open: '09:00', close: '18:00' }] }, // Friday
      { dayOfWeek: 6, isOpen: true, slots: [{ open: '09:00', close: '13:00' }] }, // Saturday
    ];
  }
  next();
});

// Static methods
businessSchema.statics.findBySlug = function (slug: string): Promise<IBusiness | null> {
  return this.findOne({ slug, status: 'active' });
};

businessSchema.statics.findNearby = function (
  longitude: number,
  latitude: number,
  maxDistanceMeters: number = 10000
): Promise<IBusiness[]> {
  return this.find({
    status: 'active',
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistanceMeters,
      },
    },
  }).limit(50);
};

export const Business = mongoose.model<IBusiness, IBusinessModel>('Business', businessSchema);
