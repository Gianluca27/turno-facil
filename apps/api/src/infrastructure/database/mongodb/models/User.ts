import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '../../../../config/index.js';

// Interfaces
export interface IAuthProvider {
  provider: 'google' | 'facebook' | 'apple';
  providerId: string;
  email?: string;
}

export interface IUserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
  birthDate?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_say';
}

export interface IUserPreferences {
  language: string;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  notifications: {
    push: boolean;
    email: boolean;
    sms: boolean;
    marketing: boolean;
  };
}

export interface IPaymentMethod {
  _id: mongoose.Types.ObjectId;
  type: 'card' | 'mercadopago';
  last4: string;
  brand?: string;
  externalId: string;
  isDefault: boolean;
}

export interface IUserFavorites {
  businesses: mongoose.Types.ObjectId[];
  professionals: mongoose.Types.ObjectId[];
}

export interface IUserStats {
  totalAppointments: number;
  totalSpent: number;
  cancelledAppointments: number;
  noShows: number;
}

export interface IRefreshToken {
  token: string;
  device?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface IUserDevice {
  deviceId: string;
  fcmToken: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  lastActive: Date;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  phone?: string;
  phoneVerified: boolean;
  password?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  profile: IUserProfile;
  authProviders: IAuthProvider[];
  preferences: IUserPreferences;
  paymentMethods: IPaymentMethod[];
  favorites: IUserFavorites;
  stats: IUserStats;
  status: 'active' | 'suspended' | 'deleted';
  refreshTokens: IRefreshToken[];
  devices: IUserDevice[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;

  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  toPublicJSON(): Partial<IUser>;
}

export interface IUserModel extends Model<IUser> {
  // Static methods
  findByEmail(email: string): Promise<IUser | null>;
  findByPhone(phone: string): Promise<IUser | null>;
  findByAuthProvider(provider: string, providerId: string): Promise<IUser | null>;
}

// Schema
const userSchema = new Schema<IUser, IUserModel>(
  {
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      select: false, // Don't include password by default in queries
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
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
      avatar: String,
      birthDate: Date,
      gender: {
        type: String,
        enum: ['male', 'female', 'other', 'prefer_not_say'],
      },
    },
    authProviders: [
      {
        provider: {
          type: String,
          enum: ['google', 'facebook', 'apple'],
          required: true,
        },
        providerId: {
          type: String,
          required: true,
        },
        email: String,
      },
    ],
    preferences: {
      language: {
        type: String,
        default: 'es',
      },
      timezone: {
        type: String,
        default: 'America/Argentina/Buenos_Aires',
      },
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system',
      },
      notifications: {
        push: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
      },
    },
    paymentMethods: [
      {
        type: {
          type: String,
          enum: ['card', 'mercadopago'],
          required: true,
        },
        last4: {
          type: String,
          required: true,
        },
        brand: String,
        externalId: {
          type: String,
          required: true,
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],
    favorites: {
      businesses: [
        {
          type: Schema.Types.ObjectId,
          ref: 'Business',
        },
      ],
      professionals: [
        {
          type: Schema.Types.ObjectId,
          ref: 'Staff',
        },
      ],
    },
    stats: {
      totalAppointments: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 },
      cancelledAppointments: { type: Number, default: 0 },
      noShows: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active',
      index: true,
    },
    refreshTokens: [
      {
        token: { type: String, required: true },
        device: String,
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
      },
    ],
    devices: [
      {
        deviceId: { type: String, required: true },
        fcmToken: { type: String, required: true },
        platform: {
          type: String,
          enum: ['ios', 'android', 'web', 'unknown'],
          default: 'unknown',
        },
        lastActive: { type: Date, default: Date.now },
      },
    ],
    lastLoginAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
userSchema.index({ 'authProviders.provider': 1, 'authProviders.providerId': 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'refreshTokens.token': 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function (this: IUser) {
  return `${this.profile.firstName} ${this.profile.lastName}`;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(config.security.bcryptRounds);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to get public user data
userSchema.methods.toPublicJSON = function (): Partial<IUser> {
  return {
    _id: this._id,
    email: this.email,
    emailVerified: this.emailVerified,
    phone: this.phone,
    phoneVerified: this.phoneVerified,
    profile: this.profile,
    preferences: this.preferences,
    favorites: this.favorites,
    stats: this.stats,
    status: this.status,
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt,
  };
};

// Static methods
userSchema.statics.findByEmail = function (email: string): Promise<IUser | null> {
  return this.findOne({ email: email.toLowerCase(), status: 'active' });
};

userSchema.statics.findByPhone = function (phone: string): Promise<IUser | null> {
  return this.findOne({ phone, status: 'active' });
};

userSchema.statics.findByAuthProvider = function (
  provider: string,
  providerId: string
): Promise<IUser | null> {
  return this.findOne({
    'authProviders.provider': provider,
    'authProviders.providerId': providerId,
    status: 'active',
  });
};

export const User = (mongoose.models.User as IUserModel) || mongoose.model<IUser, IUserModel>('User', userSchema);
