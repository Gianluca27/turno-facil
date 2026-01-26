import mongoose, { Schema, Document, Model } from 'mongoose';

// Interfaces
export interface ICashMovement {
  _id?: mongoose.Types.ObjectId;
  type: 'in' | 'out';
  amount: number;
  reason: string;
  notes?: string;
  recordedAt: Date;
  recordedBy: mongoose.Types.ObjectId;
}

export interface ICashRegisterSummary {
  totalSales: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  mercadopagoSales: number;
  mixedSales: number;
  totalRefunds: number;
  cashRefunds: number;
  totalTips: number;
  transactionCount: number;
}

export interface ICashRegister extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  openedAt: Date;
  openedBy: mongoose.Types.ObjectId;
  closedAt?: Date;
  closedBy?: mongoose.Types.ObjectId;
  initialAmount: number;
  finalAmount?: number;
  expectedAmount?: number;
  difference?: number;
  status: 'open' | 'closed';
  movements: ICashMovement[];
  summary?: ICashRegisterSummary;
  notes?: string;
  closingNotes?: string;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  addMovement(movement: Omit<ICashMovement, '_id'>): Promise<ICashRegister>;
  calculateExpectedAmount(): Promise<number>;
}

export interface ICashRegisterModel extends Model<ICashRegister> {
  findOpenByBusiness(businessId: string | mongoose.Types.ObjectId): Promise<ICashRegister | null>;
  findByBusiness(
    businessId: string | mongoose.Types.ObjectId,
    options?: { from?: Date; to?: Date; status?: 'open' | 'closed' }
  ): Promise<ICashRegister[]>;
  getHistory(
    businessId: string | mongoose.Types.ObjectId,
    options?: { page?: number; limit?: number; from?: Date; to?: Date }
  ): Promise<{ registers: ICashRegister[]; total: number }>;
}

// Schema
const cashMovementSchema = new Schema<ICashMovement>(
  {
    type: {
      type: String,
      enum: ['in', 'out'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    recordedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'BusinessUser',
      required: true,
    },
  },
  { _id: true }
);

const cashRegisterSummarySchema = new Schema<ICashRegisterSummary>(
  {
    totalSales: { type: Number, default: 0 },
    cashSales: { type: Number, default: 0 },
    cardSales: { type: Number, default: 0 },
    transferSales: { type: Number, default: 0 },
    mercadopagoSales: { type: Number, default: 0 },
    mixedSales: { type: Number, default: 0 },
    totalRefunds: { type: Number, default: 0 },
    cashRefunds: { type: Number, default: 0 },
    totalTips: { type: Number, default: 0 },
    transactionCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const cashRegisterSchema = new Schema<ICashRegister, ICashRegisterModel>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    openedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    openedBy: {
      type: Schema.Types.ObjectId,
      ref: 'BusinessUser',
      required: true,
    },
    closedAt: {
      type: Date,
    },
    closedBy: {
      type: Schema.Types.ObjectId,
      ref: 'BusinessUser',
    },
    initialAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    finalAmount: {
      type: Number,
      min: 0,
    },
    expectedAmount: {
      type: Number,
    },
    difference: {
      type: Number,
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
      index: true,
    },
    movements: {
      type: [cashMovementSchema],
      default: [],
    },
    summary: {
      type: cashRegisterSummarySchema,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    closingNotes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
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

// Indexes
cashRegisterSchema.index({ businessId: 1, status: 1 });
cashRegisterSchema.index({ businessId: 1, openedAt: -1 });
cashRegisterSchema.index({ businessId: 1, closedAt: -1 });
cashRegisterSchema.index({ openedBy: 1 });
cashRegisterSchema.index({ closedBy: 1 });

// Instance methods
cashRegisterSchema.methods.addMovement = async function (
  movement: Omit<ICashMovement, '_id'>
): Promise<ICashRegister> {
  this.movements.push({
    ...movement,
    _id: new mongoose.Types.ObjectId(),
  });
  return this.save();
};

cashRegisterSchema.methods.calculateExpectedAmount = async function (): Promise<number> {
  const movementsIn = this.movements
    .filter((m: ICashMovement) => m.type === 'in')
    .reduce((sum: number, m: ICashMovement) => sum + m.amount, 0);

  const movementsOut = this.movements
    .filter((m: ICashMovement) => m.type === 'out')
    .reduce((sum: number, m: ICashMovement) => sum + m.amount, 0);

  // This will need to be combined with actual sales data from transactions
  // The actual calculation happens in the routes where we have access to Transaction model
  return this.initialAmount + movementsIn - movementsOut;
};

// Static methods
cashRegisterSchema.statics.findOpenByBusiness = function (
  businessId: string | mongoose.Types.ObjectId
): Promise<ICashRegister | null> {
  return this.findOne({
    businessId,
    status: 'open',
  })
    .populate('openedBy', 'profile.firstName profile.lastName email')
    .exec();
};

cashRegisterSchema.statics.findByBusiness = function (
  businessId: string | mongoose.Types.ObjectId,
  options: { from?: Date; to?: Date; status?: 'open' | 'closed' } = {}
): Promise<ICashRegister[]> {
  const query: Record<string, unknown> = { businessId };

  if (options.status) {
    query.status = options.status;
  }

  if (options.from || options.to) {
    query.openedAt = {};
    if (options.from) {
      (query.openedAt as Record<string, Date>).$gte = options.from;
    }
    if (options.to) {
      (query.openedAt as Record<string, Date>).$lte = options.to;
    }
  }

  return this.find(query)
    .populate('openedBy', 'profile.firstName profile.lastName')
    .populate('closedBy', 'profile.firstName profile.lastName')
    .sort({ openedAt: -1 })
    .exec();
};

cashRegisterSchema.statics.getHistory = async function (
  businessId: string | mongoose.Types.ObjectId,
  options: { page?: number; limit?: number; from?: Date; to?: Date } = {}
): Promise<{ registers: ICashRegister[]; total: number }> {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 20, 100);
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {
    businessId,
    status: 'closed',
  };

  if (options.from || options.to) {
    query.closedAt = {};
    if (options.from) {
      (query.closedAt as Record<string, Date>).$gte = options.from;
    }
    if (options.to) {
      (query.closedAt as Record<string, Date>).$lte = options.to;
    }
  }

  const [registers, total] = await Promise.all([
    this.find(query)
      .populate('openedBy', 'profile.firstName profile.lastName')
      .populate('closedBy', 'profile.firstName profile.lastName')
      .sort({ closedAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec(),
    this.countDocuments(query),
  ]);

  return { registers, total };
};

// Pre-save middleware to validate business rules
cashRegisterSchema.pre('save', function (next) {
  // If closing, ensure closedAt and closedBy are set
  if (this.status === 'closed' && this.isModified('status')) {
    if (!this.closedAt) {
      this.closedAt = new Date();
    }
    if (this.finalAmount !== undefined && this.expectedAmount !== undefined) {
      this.difference = this.finalAmount - this.expectedAmount;
    }
  }
  next();
});

export const CashRegister = mongoose.model<ICashRegister, ICashRegisterModel>(
  'CashRegister',
  cashRegisterSchema
);
