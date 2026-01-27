import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Appointment } from '../../infrastructure/database/mongodb/models/Appointment.js';
import { Transaction } from '../../infrastructure/database/mongodb/models/Transaction.js';
import { Business } from '../../infrastructure/database/mongodb/models/Business.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { mercadoPagoService } from '../../infrastructure/external/mercadopago/index.js';
import { notificationService } from '../../domain/services/NotificationService.js';
import { logger } from '../../utils/logger.js';
import config from '../../config/index.js';

const router = Router();

// POST /api/v1/webhooks/mercadopago - MercadoPago IPN (Instant Payment Notification)
router.post(
  '/mercadopago',
  asyncHandler(async (req: Request, res: Response) => {
    const { type, data, action } = req.body;

    // Verify webhook signature if configured
    const xSignature = req.headers['x-signature'] as string;
    const xRequestId = req.headers['x-request-id'] as string;

    if (config.mercadoPago.webhookSecret && xSignature) {
      const isValid = verifyMercadoPagoSignature(
        xSignature,
        xRequestId,
        data?.id,
        config.mercadoPago.webhookSecret
      );

      if (!isValid) {
        logger.warn('Invalid MercadoPago webhook signature', {
          xRequestId,
          type,
        });
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    logger.info('MercadoPago webhook received', {
      type,
      action,
      dataId: data?.id,
      xRequestId,
    });

    try {
      switch (type) {
        case 'payment':
          await handlePaymentWebhook(data.id, action);
          break;

        case 'subscription_preapproval':
          await handleSubscriptionWebhook(data.id, action);
          break;

        case 'subscription_authorized_payment':
          await handleSubscriptionPaymentWebhook(data.id, action);
          break;

        default:
          logger.debug('Unhandled webhook type', { type, action });
      }

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Error processing MercadoPago webhook', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type,
        dataId: data?.id,
      });
      // Return 200 to prevent retries for processing errors
      res.status(200).json({ received: true, processed: false });
    }
  })
);

// Handle payment webhooks
async function handlePaymentWebhook(paymentId: number, action: string): Promise<void> {
  // Get payment details from MercadoPago
  const paymentResult = await mercadoPagoService.getPayment(paymentId);

  if (!paymentResult.success) {
    logger.error('Failed to get payment from MercadoPago', { paymentId });
    return;
  }

  const { status, externalReference, statusDetail } = paymentResult;

  if (!externalReference) {
    logger.warn('Payment without external reference', { paymentId });
    return;
  }

  logger.info('Processing payment', {
    paymentId,
    status,
    externalReference,
    action,
  });

  // Parse external reference
  const [type, id] = externalReference.split('_');

  switch (type) {
    case 'deposit':
      await handleDepositPayment(id, paymentId, status!, statusDetail!);
      break;

    case 'appointment':
      await handleAppointmentPayment(id, paymentId, status!, statusDetail!);
      break;

    case 'pos':
      await handlePOSPayment(id, paymentId, status!, statusDetail!);
      break;

    default:
      logger.warn('Unknown payment type', { type, externalReference });
  }
}

// Handle deposit payments
async function handleDepositPayment(
  appointmentId: string,
  paymentId: number,
  status: string,
  statusDetail: string
): Promise<void> {
  const appointment = await Appointment.findById(appointmentId);

  if (!appointment) {
    logger.error('Appointment not found for deposit', { appointmentId });
    return;
  }

  if (status === 'approved') {
    appointment.pricing.depositPaid = true;
    appointment.payment.status = 'partial';
    appointment.payment.method = 'mercadopago';
    appointment.payment.paidAmount = appointment.pricing.deposit;
    appointment.payment.paidAt = new Date();

    // Create transaction record
    await Transaction.create({
      businessId: appointment.businessId,
      appointmentId: appointment._id,
      clientId: appointment.clientId,
      staffId: appointment.staffId,
      type: 'deposit',
      source: 'appointment',
      amount: appointment.pricing.deposit,
      currency: 'ARS',
      paymentMethod: 'mercadopago',
      externalPayment: {
        provider: 'mercadopago',
        transactionId: paymentId.toString(),
        status,
        statusDetail,
      },
      status: 'completed',
      processedAt: new Date(),
    });

    await appointment.save();

    // Notify user if clientId exists
    if (appointment.clientId) {
      await notificationService.sendPaymentConfirmation({
        userId: appointment.clientId.toString(),
        businessId: appointment.businessId.toString(),
        appointmentId: appointment._id.toString(),
        amount: appointment.pricing.deposit,
        type: 'deposit',
      });
    }

    logger.info('Deposit payment approved', {
      appointmentId,
      paymentId,
      amount: appointment.pricing.deposit,
    });
  } else if (status === 'rejected' || status === 'cancelled') {
    logger.info('Deposit payment failed', {
      appointmentId,
      paymentId,
      status,
      statusDetail,
    });
  }
}

// Handle full appointment payments
async function handleAppointmentPayment(
  appointmentId: string,
  paymentId: number,
  status: string,
  statusDetail: string
): Promise<void> {
  const appointment = await Appointment.findById(appointmentId);

  if (!appointment) {
    logger.error('Appointment not found for payment', { appointmentId });
    return;
  }

  if (status === 'approved') {
    appointment.payment.status = 'paid';
    appointment.payment.method = 'mercadopago';
    appointment.payment.transactionId = paymentId.toString();
    appointment.payment.paidAmount = appointment.pricing.total;
    appointment.payment.paidAt = new Date();

    // Create transaction record
    await Transaction.create({
      businessId: appointment.businessId,
      appointmentId: appointment._id,
      clientId: appointment.clientId,
      staffId: appointment.staffId,
      type: 'payment',
      source: 'appointment',
      amount: appointment.pricing.total,
      currency: 'ARS',
      paymentMethod: 'mercadopago',
      externalPayment: {
        provider: 'mercadopago',
        transactionId: paymentId.toString(),
        status,
        statusDetail,
      },
      items: appointment.services.map((s) => ({
        type: 'service',
        serviceId: s.serviceId,
        name: s.name,
        quantity: 1,
        unitPrice: s.price,
        total: s.price - (s.discount || 0),
      })),
      pricing: {
        subtotal: appointment.pricing.subtotal,
        discount: appointment.pricing.discount,
        total: appointment.pricing.total,
      },
      status: 'completed',
      processedAt: new Date(),
    });

    await appointment.save();

    // Update business stats
    await Business.findByIdAndUpdate(appointment.businessId, {
      $inc: { 'stats.totalRevenue': appointment.pricing.total },
    });

    // Notify user if clientId exists
    if (appointment.clientId) {
      await notificationService.sendPaymentConfirmation({
        userId: appointment.clientId.toString(),
        businessId: appointment.businessId.toString(),
        appointmentId: appointment._id.toString(),
        amount: appointment.pricing.total,
        type: 'payment',
      });
    }

    logger.info('Appointment payment approved', {
      appointmentId,
      paymentId,
      amount: appointment.pricing.total,
    });
  }
}

// Handle POS payments
async function handlePOSPayment(
  transactionId: string,
  paymentId: number,
  status: string,
  statusDetail: string
): Promise<void> {
  const transaction = await Transaction.findById(transactionId);

  if (!transaction) {
    logger.error('Transaction not found for POS payment', { transactionId });
    return;
  }

  if (status === 'approved') {
    transaction.status = 'completed';
    transaction.externalPayment = {
      provider: 'mercadopago',
      transactionId: paymentId.toString(),
      status,
      rawResponse: { statusDetail },
    };
    transaction.processedAt = new Date();

    await transaction.save();

    // Update business stats
    await Business.findByIdAndUpdate(transaction.businessId, {
      $inc: { 'stats.totalRevenue': transaction.amount },
    });

    logger.info('POS payment approved', {
      transactionId,
      paymentId,
      amount: transaction.amount,
    });
  } else {
    transaction.status = 'failed';
    transaction.externalPayment = {
      provider: 'mercadopago',
      transactionId: paymentId.toString(),
      status,
      rawResponse: { statusDetail },
    };

    await transaction.save();

    logger.info('POS payment failed', {
      transactionId,
      paymentId,
      status,
    });
  }
}

// Handle subscription webhooks (for business plans)
async function handleSubscriptionWebhook(preapprovalId: string, action: string): Promise<void> {
  logger.info('Subscription webhook', { preapprovalId, action });

  // Find business by subscription ID
  const business = await Business.findOne({
    'subscription.mercadoPagoSubscriptionId': preapprovalId,
  });

  if (!business) {
    logger.warn('Business not found for subscription', { preapprovalId });
    return;
  }

  switch (action) {
    case 'created':
    case 'updated':
      // Subscription created or updated - might need to fetch details
      break;

    case 'cancelled':
      business.subscription.status = 'cancelled';
      await business.save();

      logger.info('Business subscription cancelled', {
        businessId: business._id,
        preapprovalId,
      });
      break;
  }
}

// Handle subscription payment webhooks
async function handleSubscriptionPaymentWebhook(
  paymentId: string,
  action: string
): Promise<void> {
  logger.info('Subscription payment webhook', { paymentId, action });

  // Handle subscription payment success/failure
  // This would typically update the business subscription status
}

// Verify MercadoPago webhook signature
function verifyMercadoPagoSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  webhookSecret: string
): boolean {
  try {
    // Parse x-signature header
    const parts = xSignature.split(',');
    let ts = '';
    let v1 = '';

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key.trim() === 'ts') {
        ts = value.trim();
      } else if (key.trim() === 'v1') {
        v1 = value.trim();
      }
    }

    // Generate manifest
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    // Calculate HMAC
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(manifest);
    const calculatedSignature = hmac.digest('hex');

    return calculatedSignature === v1;
  } catch (error) {
    logger.error('Error verifying MercadoPago signature', { error });
    return false;
  }
}

export default router;
