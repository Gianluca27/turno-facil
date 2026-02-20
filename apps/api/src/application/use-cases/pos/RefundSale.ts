import mongoose from 'mongoose';
import { Transaction } from '../../../infrastructure/database/mongodb/models/Transaction.js';
import { Product } from '../../../infrastructure/database/mongodb/models/Product.js';
import { NotFoundError, BadRequestError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface RefundSaleItemInput {
  itemIndex: number;
  quantity: number;
}

export interface RefundSaleInput {
  businessId: string;
  userId: string;
  saleId: string;
  items?: RefundSaleItemInput[];
  reason: string;
  refundMethod: 'cash' | 'card' | 'mercadopago' | 'store_credit';
}

export interface RefundSaleResult {
  refundAmount: number;
  refundedItems: Array<{
    itemIndex: number;
    name: string;
    quantity: number;
    amount: number;
  }>;
  originalTransaction: any;
  refundTransaction: any;
}

export async function refundSale(input: RefundSaleInput): Promise<RefundSaleResult> {
  const { businessId, userId, saleId, items, reason, refundMethod } = input;

  const sale = await Transaction.findOne({
    _id: saleId,
    businessId,
    type: 'sale',
    status: { $in: ['completed', 'partial_refund'] },
  });

  if (!sale) {
    throw new NotFoundError('Sale not found or already fully refunded');
  }

  let refundAmount = 0;
  const refundedItems: Array<{
    itemIndex: number;
    name: string;
    quantity: number;
    amount: number;
  }> = [];

  if (items) {
    // Partial refund
    for (const refundItem of items) {
      const saleItem = sale.items[refundItem.itemIndex];
      if (!saleItem) {
        throw new BadRequestError(`Invalid item index: ${refundItem.itemIndex}`);
      }

      const alreadyRefunded = saleItem.refundedQuantity || 0;
      const availableForRefund = saleItem.quantity - alreadyRefunded;

      if (refundItem.quantity > availableForRefund) {
        throw new BadRequestError(`Cannot refund more than ${availableForRefund} for ${saleItem.name}`);
      }

      const itemRefundAmount = (saleItem.total / saleItem.quantity) * refundItem.quantity;
      refundAmount += itemRefundAmount;

      refundedItems.push({
        itemIndex: refundItem.itemIndex,
        name: saleItem.name,
        quantity: refundItem.quantity,
        amount: itemRefundAmount,
      });

      // Update refunded quantity
      sale.items[refundItem.itemIndex].refundedQuantity = alreadyRefunded + refundItem.quantity;

      // Restore stock for products
      if (saleItem.type === 'product') {
        await Product.findByIdAndUpdate(saleItem.itemId, {
          $inc: { stock: refundItem.quantity },
        });
      }
    }

    // Check if fully refunded
    const fullyRefunded = sale.items.every(
      (item) => (item.refundedQuantity || 0) >= item.quantity
    );
    sale.status = fullyRefunded ? 'refunded' : 'partial_refund';
  } else {
    // Full refund
    refundAmount = sale.finalTotal - (sale.totalRefunded || 0);

    for (let i = 0; i < sale.items.length; i++) {
      const item = sale.items[i];
      const remainingQty = item.quantity - (item.refundedQuantity || 0);
      if (remainingQty > 0) {
        refundedItems.push({
          itemIndex: i,
          name: item.name,
          quantity: remainingQty,
          amount: (item.total / item.quantity) * remainingQty,
        });
        sale.items[i].refundedQuantity = item.quantity;

        // Restore stock for products
        if (item.type === 'product') {
          await Product.findByIdAndUpdate(item.itemId, {
            $inc: { stock: remainingQty },
          });
        }
      }
    }

    sale.status = 'refunded';
  }

  sale.totalRefunded = (sale.totalRefunded || 0) + refundAmount;
  sale.refunds = sale.refunds || [];
  sale.refunds.push({
    amount: refundAmount,
    items: refundedItems,
    reason,
    method: refundMethod,
    processedAt: new Date(),
    processedBy: new mongoose.Types.ObjectId(userId),
  });

  await sale.save();

  // Create refund transaction record
  const refundTransaction = new Transaction({
    businessId,
    type: 'refund',
    relatedTransactionId: sale._id,
    clientId: sale.clientId,
    clientInfo: sale.clientInfo,
    items: refundedItems.map((ri) => {
      const originalItem = sale.items[ri.itemIndex];
      return {
        type: originalItem.type,
        itemId: originalItem.itemId,
        name: originalItem.name,
        unitPrice: originalItem.unitPrice,
        discount: originalItem.discount,
        staffId: originalItem.staffId,
        quantity: ri.quantity,
        total: ri.amount,
      };
    }),
    refundDetails: {
      originalTransactionId: sale._id,
      refundAmount,
      refundMethod,
      reason,
    },
    finalTotal: refundAmount,
    status: 'completed',
    processedBy: new mongoose.Types.ObjectId(userId),
    processedAt: new Date(),
  });

  await refundTransaction.save();

  // Process MercadoPago refund if applicable
  // TODO: Implement MercadoPago refund when SDK method is available
  if (refundMethod === 'mercadopago' && sale.mercadoPagoPaymentId) {
    logger.warn('MercadoPago refund requested but automatic processing not yet implemented', {
      transactionId: sale._id,
      paymentId: sale.mercadoPagoPaymentId,
      refundAmount,
    });
    // Manual reconciliation will be needed
  }

  logger.info('Refund processed', {
    originalTransactionId: sale._id,
    refundTransactionId: refundTransaction._id,
    businessId,
    refundAmount,
    method: refundMethod,
  });

  return {
    refundAmount,
    refundedItems,
    originalTransaction: sale,
    refundTransaction,
  };
}
