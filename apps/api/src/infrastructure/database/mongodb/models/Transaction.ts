import mongoose, { Schema, Document, Model } from 'mongoose';

// Interfaces
export interface ITransactionItem {
  type: 'service' | 'product';
  itemId?: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  staffId?: mongoose.Types.ObjectId;
  refundedQuantity?: number;
}

export interface ITransactionPayment {
  method: 'cash' | 'card' | 'transfer' | 'mercadopago';
  amount: number;
  reference?: string;
  processedAt?: Date;
}

export interface ITransactionPricing {
  subtotal: number;
  globalDiscount: number;
  globalDiscountAmount: number;
  tip: number;
  tax?: number;
  total: number;
  previousPayments?: number;
}

export interface ITransactionClientInfo {
  name: string;
  phone?: string;
  email?: string;
}

export interface ITransactionRefund {
  amount: number;
  items: Array<{
    itemIndex: number;
    name: string;
    quantity: number;
    amount: number;
  }>;
  reason: string;
  method: 'cash' | 'card' | 'mercadopago' | 'store_credit';
  processedAt: Date;
  processedBy: mongoose.Types.ObjectId;
}

export interface IRefundDetails {
  originalTransactionId: mongoose.Types.ObjectId;
  refundAmount: number;
  refundMethod: 'cash' | 'card' | 'mercadopago' | 'store_credit';
  reason: string;
}

export interface IExternalPayment {
  provider: 'mercadopago' | 'stripe';
  transactionId: string;
  status: string;
  rawResponse?: object;
}

export interface IExpenseDetails {
  category: string;
  description: string;
  receipt?: string;
  vendor?: string;
}

// Legacy breakdown interface (for backward compatibility)
export interface ITransactionBreakdown {
  services: Array<{ serviceId: mongoose.Types.ObjectId; name: string; amount: number }>;
  discount: number;
  discountCode?: string;
  tip: number;
  tax: number;
}

export interface ITransaction extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;

  // Type and source
  type: 'payment' | 'sale' | 'refund' | 'deposit' | 'tip' | 'expense';
  source?: 'appointment' | 'pos' | 'online' | 'manual';

  // References
  appointmentId?: mongoose.Types.ObjectId;
  clientId?: mongoose.Types.ObjectId;
  staffId?: mongoose.Types.ObjectId;
  relatedTransactionId?: mongoose.Types.ObjectId;

  // Client info snapshot
  clientInfo?: ITransactionClientInfo;

  // Items (for sales)
  items: ITransactionItem[];

  // Pricing
  pricing?: ITransactionPricing;
  amount: number;
  finalTotal: number;
  currency: string;

  // Payments
  paymentMethod?: 'cash' | 'card' | 'mercadopago' | 'transfer' | 'mixed' | 'other';
  payments: ITransactionPayment[];

  // External payment integration
  externalPayment?: IExternalPayment;
  mercadoPagoPaymentId?: string;

  // Refunds
  totalRefunded: number;
  refunds: ITransactionRefund[];
  refundDetails?: IRefundDetails;

  // Legacy breakdown (for backward compatibility)
  breakdown?: ITransactionBreakdown;

  // Expense details
  expense?: IExpenseDetails;

  // Status
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded' | 'partial_refund';

  // Metadata
  notes?: string;
  receiptNumber?: string;
  invoiceNumber?: string;

  // Processing info
  processedAt?: Date;
  processedBy?: mongoose.Types.ObjectId;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface ITransactionModel extends Model<ITransaction> {
  findByBusiness(
    businessId: string | mongoose.Types.ObjectId,
    options?: { from?: Date; to?: Date; type?: string; status?: string }
  ): Promise<ITransaction[]>;
  getTotalRevenue(businessId: string | mongoose.Types.ObjectId, from: Date, to: Date): Promise<number>;
  getSalesSummary(
    businessId: string | mongoose.Types.ObjectId,
    from: Date,
    to: Date
  ): Promise<{
    totalSales: number;
    totalRefunds: number;
    netSales: number;
    transactionCount: number;
    byPaymentMethod: Record<string, { total: number; count: number }>;
  }>;
  generateReceiptNumber(businessId: string | mongoose.Types.ObjectId): Promise<string>;
}

// Schemas
const transactionItemSchema = new Schema<ITransactionItem>(
  {
    type: {
      type: String,
      enum: ['service', 'product'],
      required: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      refPath: 'items.type',
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
    },
    refundedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const transactionPaymentSchema = new Schema<ITransactionPayment>(
  {
    method: {
      type: String,
      enum: ['cash', 'card', 'transfer', 'mercadopago'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    reference: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const transactionPricingSchema = new Schema<ITransactionPricing>(
  {
    subtotal: { type: Number, required: true, min: 0 },
    globalDiscount: { type: Number, default: 0, min: 0, max: 100 },
    globalDiscountAmount: { type: Number, default: 0, min: 0 },
    tip: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    previousPayments: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const transactionClientInfoSchema = new Schema<ITransactionClientInfo>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, maxlength: 100 },
  },
  { _id: false }
);

const transactionRefundSchema = new Schema<ITransactionRefund>(
  {
    amount: { type: Number, required: true, min: 0 },
    items: [
      {
        itemIndex: { type: Number, required: true, min: 0 },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    method: {
      type: String,
      enum: ['cash', 'card', 'mercadopago', 'store_credit'],
      required: true,
    },
    processedAt: { type: Date, required: true },
    processedBy: { type: Schema.Types.ObjectId, ref: 'BusinessUser', required: true },
  },
  { _id: true }
);

const refundDetailsSchema = new Schema<IRefundDetails>(
  {
    originalTransactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
    refundAmount: { type: Number, required: true, min: 0 },
    refundMethod: {
      type: String,
      enum: ['cash', 'card', 'mercadopago', 'store_credit'],
      required: true,
    },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const externalPaymentSchema = new Schema<IExternalPayment>(
  {
    provider: { type: String, enum: ['mercadopago', 'stripe'], required: true },
    transactionId: { type: String, required: true },
    status: { type: String, required: true },
    rawResponse: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const expenseDetailsSchema = new Schema<IExpenseDetails>(
  {
    category: { type: String, required: true, trim: true, maxlength: 50 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    receipt: { type: String },
    vendor: { type: String, trim: true, maxlength: 100 },
  },
  { _id: false }
);

// Legacy breakdown schema (for backward compatibility)
const breakdownSchema = new Schema<ITransactionBreakdown>(
  {
    services: [
      {
        serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
        name: { type: String },
        amount: { type: Number },
      },
    ],
    discount: { type: Number, default: 0 },
    discountCode: { type: String },
    tip: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
  },
  { _id: false }
);

// Main Transaction Schema
const transactionSchema = new Schema<ITransaction, ITransactionModel>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['payment', 'sale', 'refund', 'deposit', 'tip', 'expense'],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['appointment', 'pos', 'online', 'manual'],
    },
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      index: true,
    },
    relatedTransactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    clientInfo: transactionClientInfoSchema,
    items: {
      type: [transactionItemSchema],
      default: [],
    },
    pricing: transactionPricingSchema,
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    finalTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'ARS',
      uppercase: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'mercadopago', 'transfer', 'mixed', 'other'],
    },
    payments: {
      type: [transactionPaymentSchema],
      default: [],
    },
    externalPayment: externalPaymentSchema,
    mercadoPagoPaymentId: {
      type: String,
      sparse: true,
    },
    totalRefunded: {
      type: Number,
      default: 0,
      min: 0,
    },
    refunds: {
      type: [transactionRefundSchema],
      default: [],
    },
    refundDetails: refundDetailsSchema,
    breakdown: breakdownSchema,
    expense: expenseDetailsSchema,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded', 'partial_refund'],
      default: 'pending',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    receiptNumber: {
      type: String,
      sparse: true,
    },
    invoiceNumber: {
      type: String,
      sparse: true,
    },
    processedAt: {
      type: Date,
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'BusinessUser',
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
transactionSchema.index({ businessId: 1, createdAt: -1 });
transactionSchema.index({ businessId: 1, type: 1, createdAt: -1 });
transactionSchema.index({ businessId: 1, status: 1, createdAt: -1 });
transactionSchema.index({ businessId: 1, staffId: 1, createdAt: -1 });
transactionSchema.index({ businessId: 1, processedAt: -1 });
transactionSchema.index({ businessId: 1, paymentMethod: 1, processedAt: -1 });
transactionSchema.index({ 'externalPayment.transactionId': 1 }, { sparse: true });
transactionSchema.index({ mercadoPagoPaymentId: 1 }, { sparse: true });
transactionSchema.index({ receiptNumber: 1, businessId: 1 }, { sparse: true });
transactionSchema.index({ relatedTransactionId: 1 }, { sparse: true });

// Static methods
transactionSchema.statics.findByBusiness = function (
  businessId: string | mongoose.Types.ObjectId,
  options: { from?: Date; to?: Date; type?: string; status?: string } = {}
): Promise<ITransaction[]> {
  const query: Record<string, unknown> = { businessId };

  if (options.from || options.to) {
    query.createdAt = {};
    if (options.from) (query.createdAt as Record<string, Date>).$gte = options.from;
    if (options.to) (query.createdAt as Record<string, Date>).$lte = options.to;
  }

  if (options.type) query.type = options.type;
  if (options.status) query.status = options.status;

  return this.find(query).sort({ createdAt: -1 });
};

transactionSchema.statics.getTotalRevenue = async function (
  businessId: string | mongoose.Types.ObjectId,
  from: Date,
  to: Date
): Promise<number> {
  const result = await this.aggregate([
    {
      $match: {
        businessId: new mongoose.Types.ObjectId(businessId.toString()),
        type: { $in: ['payment', 'sale'] },
        status: { $in: ['completed', 'partial_refund'] },
        createdAt: { $gte: from, $lte: to },
      },
    },
    { $group: { _id: null, total: { $sum: '$finalTotal' } } },
  ]);
  return result[0]?.total || 0;
};

transactionSchema.statics.getSalesSummary = async function (
  businessId: string | mongoose.Types.ObjectId,
  from: Date,
  to: Date
): Promise<{
  totalSales: number;
  totalRefunds: number;
  netSales: number;
  transactionCount: number;
  byPaymentMethod: Record<string, { total: number; count: number }>;
}> {
  const businessObjId = new mongoose.Types.ObjectId(businessId.toString());

  const [salesData, refundsData, byMethodData] = await Promise.all([
    this.aggregate([
      {
        $match: {
          businessId: businessObjId,
          type: { $in: ['payment', 'sale'] },
          status: { $in: ['completed', 'partial_refund'] },
          processedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$finalTotal' },
          count: { $sum: 1 },
        },
      },
    ]),
    this.aggregate([
      {
        $match: {
          businessId: businessObjId,
          type: 'refund',
          status: 'completed',
          processedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$finalTotal' },
        },
      },
    ]),
    this.aggregate([
      {
        $match: {
          businessId: businessObjId,
          type: { $in: ['payment', 'sale'] },
          status: { $in: ['completed', 'partial_refund'] },
          processedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$finalTotal' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const totalSales = salesData[0]?.total || 0;
  const totalRefunds = refundsData[0]?.total || 0;
  const transactionCount = salesData[0]?.count || 0;

  const byPaymentMethod: Record<string, { total: number; count: number }> = {};
  for (const item of byMethodData) {
    if (item._id) {
      byPaymentMethod[item._id] = { total: item.total, count: item.count };
    }
  }

  return {
    totalSales,
    totalRefunds,
    netSales: totalSales - totalRefunds,
    transactionCount,
    byPaymentMethod,
  };
};

transactionSchema.statics.generateReceiptNumber = async function (
  businessId: string | mongoose.Types.ObjectId
): Promise<string> {
  const today = new Date();
  const datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  const lastTransaction = await this.findOne({
    businessId,
    receiptNumber: { $regex: `^${datePrefix}` },
  }).sort({ receiptNumber: -1 });

  let sequence = 1;
  if (lastTransaction?.receiptNumber) {
    const lastSequence = parseInt(lastTransaction.receiptNumber.slice(-4), 10);
    sequence = lastSequence + 1;
  }

  return `${datePrefix}${String(sequence).padStart(4, '0')}`;
};

// Pre-save middleware
transactionSchema.pre('save', function (next) {
  // Ensure amount equals finalTotal if not set
  if (this.amount === undefined || this.amount === null) {
    this.amount = this.finalTotal;
  }

  // Set processedAt if status is completed and not already set
  if (this.status === 'completed' && !this.processedAt) {
    this.processedAt = new Date();
  }

  next();
});

export const Transaction = mongoose.model<ITransaction, ITransactionModel>('Transaction', transactionSchema);
