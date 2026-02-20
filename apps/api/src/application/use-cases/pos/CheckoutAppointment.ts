import mongoose from 'mongoose';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { Appointment } from '../../../infrastructure/database/mongodb/models/Appointment.js';
import { Product } from '../../../infrastructure/database/mongodb/models/Product.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface AdditionalItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface CheckoutAppointmentInput {
  businessId: string;
  userId: string;
  appointmentId: string;
  paymentMethod: string;
  tip?: number;
  additionalItems?: AdditionalItem[];
}

export interface CheckoutAppointmentResult {
  transaction: any;
}

export async function checkoutAppointment(input: CheckoutAppointmentInput): Promise<CheckoutAppointmentResult> {
  const { businessId, userId, appointmentId, paymentMethod, tip, additionalItems } = input;

  const appointment = await Appointment.findOne({
    _id: appointmentId,
    businessId,
    status: 'completed',
    'payment.status': { $in: ['pending', 'partial'] },
  });

  if (!appointment) {
    throw new NotFoundError('Appointment not found or already paid');
  }

  // Calculate remaining amount
  const paidAmount = appointment.pricing.depositPaid ? appointment.pricing.deposit : 0;
  const appointmentTotal = appointment.pricing.total;
  let remainingAmount = appointmentTotal - paidAmount;

  // Process additional items (products)
  const items: Array<{
    type: 'service' | 'product';
    itemId?: mongoose.Types.ObjectId;
    name: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
    staffId?: mongoose.Types.ObjectId;
  }> = [];

  // Add appointment services
  for (const service of appointment.services) {
    items.push({
      type: 'service',
      itemId: service.serviceId,
      name: service.name,
      quantity: 1,
      unitPrice: service.price,
      discount: service.discount || 0,
      total: service.price - (service.price * (service.discount || 0) / 100),
      staffId: appointment.staffId,
    });
  }

  // Add additional products
  if (additionalItems && additionalItems.length > 0) {
    for (const addItem of additionalItems) {
      const product = await Product.findOne({
        _id: addItem.productId,
        businessId,
        status: 'active',
      });

      if (!product) {
        throw new NotFoundError(`Product not found: ${addItem.productId}`);
      }

      if (product.stock < addItem.quantity) {
        throw new BadRequestError(`Insufficient stock for ${product.name}`);
      }

      const itemTotal = product.price * addItem.quantity;
      items.push({
        type: 'product',
        itemId: product._id,
        name: product.name,
        quantity: addItem.quantity,
        unitPrice: product.price,
        discount: 0,
        total: itemTotal,
      });

      remainingAmount += itemTotal;
      product.stock -= addItem.quantity;
      await product.save();
    }
  }

  const tipAmount = tip || 0;
  const finalTotal = remainingAmount + tipAmount;

  const transaction = new Transaction({
    businessId,
    type: 'sale',
    source: 'appointment',
    appointmentId: appointment._id,
    clientId: appointment.clientId,
    clientInfo: appointment.clientInfo,
    items,
    pricing: {
      subtotal: appointmentTotal + (additionalItems?.reduce((sum: number, ai: AdditionalItem) => sum + ai.quantity * ai.price, 0) || 0),
      previousPayments: paidAmount,
      tip: tipAmount,
      total: finalTotal,
    },
    paymentMethod,
    payments: [{ method: paymentMethod, amount: finalTotal }],
    finalTotal,
    status: 'completed',
    processedBy: new mongoose.Types.ObjectId(userId),
    processedAt: new Date(),
  });

  await transaction.save();

  // Update appointment
  appointment.payment.status = 'paid';
  appointment.payment.paidAt = new Date();
  appointment.payment.paidAmount = finalTotal;
  appointment.pricing.tip = tipAmount;
  appointment.pricing.finalTotal = appointment.pricing.total + tipAmount;
  await appointment.save();

  logger.info('Appointment checkout completed', {
    appointmentId: appointment._id,
    transactionId: transaction._id,
    businessId,
    total: finalTotal,
  });

  return { transaction };
}
