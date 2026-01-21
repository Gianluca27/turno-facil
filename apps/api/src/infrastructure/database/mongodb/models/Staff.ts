import mongoose, { Schema, Document, Model } from 'mongoose';

// Interfaces
export interface IStaffProfile {
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  specialties: string[];
}

export interface IStaffContact {
  email?: string;
  phone?: string;
}

export interface ITimeSlot {
  start: string;
  end: string;
}

export interface IScheduleDay {
  dayOfWeek: number;
  isAvailable: boolean;
  slots: ITimeSlot[];
}

export interface IStaffSchedule {
  useBusinessSchedule: boolean;
  custom: IScheduleDay[];
}

export interface IStaffException {
  _id: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  type: 'vacation' | 'sick' | 'personal' | 'other';
  reason?: string;
  isRecurring: boolean;
  recurringPattern?: {
    frequency: 'weekly' | 'monthly';
    daysOfWeek: number[];
  };
}

export interface IStaffConfig {
  bufferTime?: number;
  maxDailyAppointments?: number;
  acceptsNewClients: boolean;
}

export interface IStaffStats {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
}

export interface IStaff extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  profile: IStaffProfile;
  contact: IStaffContact;
  services: mongoose.Types.ObjectId[];
  schedule: IStaffSchedule;
  exceptions: IStaffException[];
  config: IStaffConfig;
  stats: IStaffStats;
  order: number;
  status: 'active' | 'inactive' | 'vacation' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

export interface IStaffModel extends Model<IStaff> {
  findByBusiness(businessId: string | mongoose.Types.ObjectId): Promise<IStaff[]>;
  findActiveByBusiness(businessId: string | mongoose.Types.ObjectId): Promise<IStaff[]>;
}

// Schema
const staffSchema = new Schema<IStaff, IStaffModel>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'BusinessUser',
      sparse: true,
      index: true,
    },
    profile: {
      firstName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50,
      },
      lastName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50,
      },
      displayName: {
        type: String,
        trim: true,
        maxlength: 100,
      },
      avatar: String,
      bio: {
        type: String,
        maxlength: 500,
      },
      specialties: {
        type: [String],
        default: [],
      },
    },
    contact: {
      email: {
        type: String,
        lowercase: true,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
    },
    services: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Service',
      },
    ],
    schedule: {
      useBusinessSchedule: {
        type: Boolean,
        default: true,
      },
      custom: [
        {
          dayOfWeek: {
            type: Number,
            min: 0,
            max: 6,
            required: true,
          },
          isAvailable: {
            type: Boolean,
            default: true,
          },
          slots: [
            {
              start: { type: String, required: true },
              end: { type: String, required: true },
            },
          ],
        },
      ],
    },
    exceptions: [
      {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        type: {
          type: String,
          enum: ['vacation', 'sick', 'personal', 'other'],
          required: true,
        },
        reason: String,
        isRecurring: { type: Boolean, default: false },
        recurringPattern: {
          frequency: {
            type: String,
            enum: ['weekly', 'monthly'],
          },
          daysOfWeek: [Number],
        },
      },
    ],
    config: {
      bufferTime: Number,
      maxDailyAppointments: Number,
      acceptsNewClients: { type: Boolean, default: true },
    },
    stats: {
      totalAppointments: { type: Number, default: 0 },
      completedAppointments: { type: Number, default: 0 },
      cancelledAppointments: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
    },
    order: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'vacation', 'deleted'],
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
staffSchema.index({ businessId: 1, status: 1 });
staffSchema.index({ businessId: 1, services: 1 });

// Virtual for full name
staffSchema.virtual('fullName').get(function (this: IStaff) {
  return this.profile.displayName || `${this.profile.firstName} ${this.profile.lastName}`;
});

// Static methods
staffSchema.statics.findByBusiness = function (
  businessId: string | mongoose.Types.ObjectId
): Promise<IStaff[]> {
  return this.find({
    businessId,
    status: { $ne: 'deleted' },
  }).sort({ order: 1, 'profile.firstName': 1 });
};

staffSchema.statics.findActiveByBusiness = function (
  businessId: string | mongoose.Types.ObjectId
): Promise<IStaff[]> {
  return this.find({
    businessId,
    status: 'active',
  }).sort({ order: 1, 'profile.firstName': 1 });
};

export const Staff = mongoose.model<IStaff, IStaffModel>('Staff', staffSchema);
