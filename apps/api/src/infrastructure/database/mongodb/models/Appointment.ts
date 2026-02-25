import mongoose, { Schema, Document, Model } from 'mongoose';

// Interfaces
export interface IClientInfo {
  name: string;
  phone: string;
  email?: string;
}

export interface IStaffInfo {
  name: string;
}

export interface IAppointmentService {
  serviceId: mongoose.Types.ObjectId;
  name: string;
  duration: number;
  price: number;
  discount: number;
}

export interface IAppointmentPricing {
  subtotal: number;
  discount: number;
  discountCode?: string;
  deposit: number;
  depositPaid: boolean;
  total: number;
  tip: number;
  finalTotal: number;
}

export interface IStatusHistory {
  status: string;
  changedAt: Date;
  changedBy?: mongoose.Types.ObjectId;
  reason?: string;
}

export interface ICancellation {
  cancelledAt: Date;
  cancelledBy: 'client' | 'business';
  reason?: string;
  refunded: boolean;
  refundAmount: number;
}

export interface IAppointmentPayment {
  status: 'pending' | 'partial' | 'paid' | 'refunded';
  method?: 'cash' | 'card' | 'mercadopago' | 'transfer';
  transactionId?: string;
  paidAt?: Date;
  paidAmount: number;
}

export interface IAppointmentNotes {
  client?: string;
  business?: string;
  staff?: string;
}

export interface IReminderSent {
  type: 'confirmation' | '24h' | '2h' | 'custom';
  channel: 'push' | 'sms' | 'email' | 'whatsapp';
  sentAt: Date;
  status: 'sent' | 'delivered' | 'failed';
}

export interface IAppointmentReview {
  submitted: boolean;
  requestedAt?: Date;
}

export interface IRecurrence {
  isRecurring: boolean;
  parentId?: mongoose.Types.ObjectId;
  pattern?: 'weekly' | 'biweekly' | 'monthly';
  endsAt?: Date;
}

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type AppointmentSource = 'app_client' | 'app_business' | 'manual' | 'api';

export interface IAppointment extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  clientId?: mongoose.Types.ObjectId;
  clientInfo: IClientInfo;
  staffId: mongoose.Types.ObjectId;
  staffInfo: IStaffInfo;
  services: IAppointmentService[];
  date: Date;
  startTime: string;
  endTime: string;
  startDateTime: Date;
  endDateTime: Date;
  totalDuration: number;
  pricing: IAppointmentPricing;
  status: AppointmentStatus;
  statusHistory: IStatusHistory[];
  cancellation?: ICancellation;
  payment: IAppointmentPayment;
  notes: IAppointmentNotes;
  reminders: IReminderSent[];
  review: IAppointmentReview;
  source: AppointmentSource;
  recurrence: IRecurrence;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
}

export interface IAppointmentModel extends Model<IAppointment> {
  findByBusiness(businessId: string, date?: Date): Promise<IAppointment[]>;
  findByClient(clientId: string): Promise<IAppointment[]>;
  findByStaff(staffId: string, date?: Date): Promise<IAppointment[]>;
  findUpcoming(businessId: string, limit?: number): Promise<IAppointment[]>;
}

// Schema
const appointmentSchema = new Schema<IAppointment, IAppointmentModel>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    clientInfo: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        lowercase: true,
        trim: true,
      },
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
      index: true,
    },
    staffInfo: {
      name: {
        type: String,
        required: true,
      },
    },
    services: [
      {
        serviceId: {
          type: Schema.Types.ObjectId,
          ref: 'Service',
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        duration: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        discount: {
          type: Number,
          default: 0,
        },
      },
    ],
    date: {
      type: Date,
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    startDateTime: {
      type: Date,
      required: true,
      index: true,
    },
    endDateTime: {
      type: Date,
      required: true,
    },
    totalDuration: {
      type: Number,
      required: true,
    },
    pricing: {
      subtotal: {
        type: Number,
        required: true,
      },
      discount: {
        type: Number,
        default: 0,
      },
      discountCode: String,
      deposit: {
        type: Number,
        default: 0,
      },
      depositPaid: {
        type: Boolean,
        default: false,
      },
      total: {
        type: Number,
        required: true,
      },
      tip: {
        type: Number,
        default: 0,
      },
      finalTotal: {
        type: Number,
        required: true,
      },
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'],
      default: 'pending',
      index: true,
    },
    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: Schema.Types.ObjectId,
        },
        reason: String,
      },
    ],
    cancellation: {
      cancelledAt: Date,
      cancelledBy: {
        type: String,
        enum: ['client', 'business'],
      },
      reason: String,
      refunded: {
        type: Boolean,
        default: false,
      },
      refundAmount: {
        type: Number,
        default: 0,
      },
    },
    payment: {
      status: {
        type: String,
        enum: ['pending', 'partial', 'paid', 'refunded'],
        default: 'pending',
      },
      method: {
        type: String,
        enum: ['cash', 'card', 'mercadopago', 'transfer'],
      },
      transactionId: String,
      paidAt: Date,
      paidAmount: {
        type: Number,
        default: 0,
      },
    },
    notes: {
      client: String,
      business: String,
      staff: String,
    },
    reminders: [
      {
        type: {
          type: String,
          enum: ['confirmation', '24h', '2h', 'custom'],
          required: true,
        },
        channel: {
          type: String,
          enum: ['push', 'sms', 'email', 'whatsapp'],
          required: true,
        },
        sentAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ['sent', 'delivered', 'failed'],
          default: 'sent',
        },
      },
    ],
    review: {
      submitted: {
        type: Boolean,
        default: false,
      },
      requestedAt: Date,
    },
    source: {
      type: String,
      enum: ['app_client', 'app_business', 'manual', 'api'],
      default: 'app_client',
    },
    recurrence: {
      isRecurring: {
        type: Boolean,
        default: false,
      },
      parentId: {
        type: Schema.Types.ObjectId,
        ref: 'Appointment',
      },
      pattern: {
        type: String,
        enum: ['weekly', 'biweekly', 'monthly'],
      },
      endsAt: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
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
appointmentSchema.index({ businessId: 1, date: 1, status: 1 });
appointmentSchema.index({ businessId: 1, staffId: 1, date: 1 });
appointmentSchema.index({ clientId: 1, status: 1 });
appointmentSchema.index({ businessId: 1, startDateTime: 1, endDateTime: 1 });
appointmentSchema.index({ status: 1, date: 1 });
appointmentSchema.index({ 'recurrence.parentId': 1 });

// Pre-save middleware to update status history
appointmentSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date(),
    });
  }
  next();
});

// Static methods
appointmentSchema.statics.findByBusiness = function (
  businessId: string,
  date?: Date
): Promise<IAppointment[]> {
  const query: any = { businessId };

  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    query.date = { $gte: startOfDay, $lte: endOfDay };
  }

  return this.find(query)
    .populate('staffId', 'profile')
    .sort({ startDateTime: 1 });
};

appointmentSchema.statics.findByClient = function (clientId: string): Promise<IAppointment[]> {
  return this.find({ clientId })
    .populate('businessId', 'name slug media.logo')
    .populate('staffId', 'profile')
    .sort({ startDateTime: -1 });
};

appointmentSchema.statics.findByStaff = function (
  staffId: string,
  date?: Date
): Promise<IAppointment[]> {
  const query: any = { staffId };

  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    query.date = { $gte: startOfDay, $lte: endOfDay };
  }

  return this.find(query).sort({ startDateTime: 1 });
};

appointmentSchema.statics.findUpcoming = function (
  businessId: string,
  limit: number = 10
): Promise<IAppointment[]> {
  const now = new Date();

  return this.find({
    businessId,
    startDateTime: { $gte: now },
    status: { $in: ['pending', 'confirmed'] },
  })
    .populate('staffId', 'profile')
    .sort({ startDateTime: 1 })
    .limit(limit);
};

export const Appointment = (mongoose.models.Appointment as IAppointmentModel) || mongoose.model<IAppointment, IAppointmentModel>(
  'Appointment',
  appointmentSchema
);
