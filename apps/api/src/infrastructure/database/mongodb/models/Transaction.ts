import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITransactionBreakdown {
  services: Array<{ serviceId: mongoose.Types.ObjectId; name: string; amount: number }>;
  discount: number;
  discountCode?: string;
  tip: number;
  tax: number;
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
}

export interface ITransaction extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  appointmentId?: mongoose.Types.ObjectId;
  clientId?: mongoose.Types.ObjectId;
  staffId?: mongoose.Types.ObjectId;
  type: 'payment' | 'refund' | 'deposit' | 'tip' | 'expense';
  amount: number;
  currency: string;
  paymentMethod?: 'cash' | 'card' | 'mercadopago' | 'transfer' | 'other';
  externalPayment?: IExternalPayment;
  breakdown?: ITransactionBreakdown;
  expense?: IExpenseDetails;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  notes?: string;
  processedAt?: Date;
  processedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITransactionModel extends Model<ITransaction> {
  findByBusiness(businessId: string, options?: { from?: Date; to?: Date; type?: string }): Promise<ITransaction[]>;
  getTotalRevenue(businessId: string, from: Date, to: Date): Promise<number>;
}

const transactionSchema = new Schema<ITransaction, ITransactionModel>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'User' },
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff', index: true },
    type: { type: String, enum: ['payment', 'refund', 'deposit', 'tip', 'expense'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'ARS' },
    paymentMethod: { type: String, enum: ['cash', 'card', 'mercadopago', 'transfer', 'other'] },
    externalPayment: {
      provider: { type: String, enum: ['mercadopago', 'stripe'] },
      transactionId: String,
      status: String,
      rawResponse: Schema.Types.Mixed,
    },
    breakdown: {
      services: [{ serviceId: Schema.Types.ObjectId, name: String, amount: Number }],
      discount: Number,
      discountCode: String,
      tip: Number,
      tax: Number,
    },
    expense: {
      category: String,
      description: String,
      receipt: String,
    },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded'], default: 'pending' },
    notes: String,
    processedAt: Date,
    processedBy: Schema.Types.ObjectId,
  },
  { timestamps: true }
);

transactionSchema.index({ businessId: 1, createdAt: -1 });
transactionSchema.index({ businessId: 1, type: 1, createdAt: -1 });
transactionSchema.index({ businessId: 1, staffId: 1, createdAt: -1 });
transactionSchema.index({ 'externalPayment.transactionId': 1 });

transactionSchema.statics.findByBusiness = function (businessId: string, options: any = {}): Promise<ITransaction[]> {
  const query: any = { businessId };
  if (options.from || options.to) {
    query.createdAt = {};
    if (options.from) query.createdAt.$gte = options.from;
    if (options.to) query.createdAt.$lte = options.to;
  }
  if (options.type) query.type = options.type;
  return this.find(query).sort({ createdAt: -1 });
};

transactionSchema.statics.getTotalRevenue = async function (businessId: string, from: Date, to: Date): Promise<number> {
  const result = await this.aggregate([
    { $match: { businessId: new mongoose.Types.ObjectId(businessId), type: 'payment', status: 'completed', createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result[0]?.total || 0;
};

export const Transaction = mongoose.model<ITransaction, ITransactionModel>('Transaction', transactionSchema);
