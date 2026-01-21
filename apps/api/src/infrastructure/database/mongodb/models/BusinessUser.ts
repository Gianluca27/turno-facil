import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '../../../../config/index.js';

// Interfaces
export interface IBusinessUserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
}

export interface IBusinessAssociation {
  businessId: mongoose.Types.ObjectId;
  role: 'owner' | 'admin' | 'manager' | 'employee' | 'reception';
  permissions: string[];
  joinedAt: Date;
}

export interface IBusinessUserPreferences {
  language: string;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  notifications: {
    push: boolean;
    email: boolean;
    sms: boolean;
    newBooking: boolean;
    cancellation: boolean;
    reminder: boolean;
  };
}

export interface IRefreshToken {
  token: string;
  device?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface IBusinessUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  phone?: string;
  password: string;
  profile: IBusinessUserProfile;
  businesses: IBusinessAssociation[];
  preferences: IBusinessUserPreferences;
  refreshTokens: IRefreshToken[];
  status: 'active' | 'suspended' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;

  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  hasAccessToBusiness(businessId: string): boolean;
  getBusinessRole(businessId: string): string | null;
  getBusinessPermissions(businessId: string): string[];
}

export interface IBusinessUserModel extends Model<IBusinessUser> {
  findByEmail(email: string): Promise<IBusinessUser | null>;
}

// Default permissions by role
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  admin: [
    'business:read',
    'business:update',
    'staff:*',
    'services:*',
    'appointments:*',
    'clients:*',
    'finances:read',
    'finances:transactions',
    'marketing:*',
    'analytics:*',
    'settings:read',
    'settings:update',
    'team:read',
    'team:invite',
  ],
  manager: [
    'business:read',
    'staff:read',
    'staff:schedule',
    'services:read',
    'appointments:*',
    'clients:read',
    'clients:update',
    'finances:read',
    'marketing:read',
    'analytics:read',
  ],
  employee: [
    'appointments:read:own',
    'appointments:update:own',
    'clients:read',
    'analytics:read:own',
  ],
  reception: [
    'appointments:*',
    'clients:read',
    'clients:create',
    'services:read',
    'staff:read',
  ],
};

// Schema
const businessUserSchema = new Schema<IBusinessUser, IBusinessUserModel>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: true,
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
    },
    businesses: [
      {
        businessId: {
          type: Schema.Types.ObjectId,
          ref: 'Business',
          required: true,
        },
        role: {
          type: String,
          enum: ['owner', 'admin', 'manager', 'employee', 'reception'],
          required: true,
        },
        permissions: {
          type: [String],
          default: [],
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
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
        sms: { type: Boolean, default: false },
        newBooking: { type: Boolean, default: true },
        cancellation: { type: Boolean, default: true },
        reminder: { type: Boolean, default: true },
      },
    },
    refreshTokens: [
      {
        token: { type: String, required: true },
        device: String,
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
      },
    ],
    status: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active',
      index: true,
    },
    lastLoginAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
businessUserSchema.index({ 'businesses.businessId': 1 });
businessUserSchema.index({ 'refreshTokens.token': 1 });

// Virtual for full name
businessUserSchema.virtual('fullName').get(function (this: IBusinessUser) {
  return `${this.profile.firstName} ${this.profile.lastName}`;
});

// Pre-save middleware to hash password
businessUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
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

// Pre-save middleware to set default permissions based on role
businessUserSchema.pre('save', function (next) {
  this.businesses.forEach((business) => {
    if (business.permissions.length === 0) {
      business.permissions = ROLE_PERMISSIONS[business.role] || [];
    }
  });
  next();
});

// Instance methods
businessUserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

businessUserSchema.methods.hasAccessToBusiness = function (businessId: string): boolean {
  return this.businesses.some(
    (b: IBusinessAssociation) => b.businessId.toString() === businessId
  );
};

businessUserSchema.methods.getBusinessRole = function (businessId: string): string | null {
  const business = this.businesses.find(
    (b: IBusinessAssociation) => b.businessId.toString() === businessId
  );
  return business ? business.role : null;
};

businessUserSchema.methods.getBusinessPermissions = function (businessId: string): string[] {
  const business = this.businesses.find(
    (b: IBusinessAssociation) => b.businessId.toString() === businessId
  );
  return business ? business.permissions : [];
};

// Static methods
businessUserSchema.statics.findByEmail = function (email: string): Promise<IBusinessUser | null> {
  return this.findOne({ email: email.toLowerCase(), status: 'active' });
};

export const BusinessUser = mongoose.model<IBusinessUser, IBusinessUserModel>(
  'BusinessUser',
  businessUserSchema
);
