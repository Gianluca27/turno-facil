import { MercadoPagoConfig, Payment, Preference, PreApproval, PreApprovalPlan } from 'mercadopago';
import config from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import crypto from 'crypto';

export interface CreatePaymentParams {
  amount: number;
  description: string;
  payerEmail: string;
  payerFirstName?: string;
  payerLastName?: string;
  payerPhone?: string;
  payerIdentification?: {
    type: string;
    number: string;
  };
  externalReference: string;
  metadata?: Record<string, unknown>;
}

export interface CreatePreferenceParams {
  items: {
    title: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    pictureUrl?: string;
  }[];
  payer?: {
    email: string;
    name?: string;
    phone?: string;
  };
  externalReference: string;
  backUrls?: {
    success: string;
    failure: string;
    pending: string;
  };
  autoReturn?: 'approved' | 'all';
  notificationUrl?: string;
  metadata?: Record<string, unknown>;
  expires?: boolean;
  expirationDateFrom?: Date;
  expirationDateTo?: Date;
}

export interface CreateSubscriptionPlanParams {
  reason: string;
  autoRecurring: {
    frequency: number;
    frequencyType: 'days' | 'months';
    transactionAmount: number;
    currencyId?: string;
  };
  backUrl?: string;
}

export interface CreateSubscriptionParams {
  preapprovalPlanId: string;
  payerEmail: string;
  externalReference: string;
  reason?: string;
  backUrl?: string;
}

export interface RefundParams {
  paymentId: number;
  amount?: number;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: number;
  status?: string;
  statusDetail?: string;
  externalReference?: string;
  error?: string;
}

export interface PreferenceResult {
  success: boolean;
  preferenceId?: string;
  initPoint?: string;
  sandboxInitPoint?: string;
  error?: string;
}

export interface SubscriptionPlanResult {
  success: boolean;
  planId?: string;
  initPoint?: string;
  error?: string;
}

export interface SubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  status?: string;
  initPoint?: string;
  error?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: number;
  status?: string;
  amount?: number;
  error?: string;
}

export interface WebhookPayload {
  id: number;
  live_mode: boolean;
  type: string;
  date_created: string;
  user_id: number;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

class MercadoPagoService {
  private client: MercadoPagoConfig | null = null;
  private payment: Payment | null = null;
  private preference: Preference | null = null;
  private preApproval: PreApproval | null = null;
  private preApprovalPlan: PreApprovalPlan | null = null;
  private initialized: boolean = false;
  private webhookSecret: string | undefined;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const { accessToken, webhookSecret } = config.mercadoPago;

    if (accessToken) {
      this.client = new MercadoPagoConfig({
        accessToken,
        options: {
          timeout: 5000,
        },
      });

      this.payment = new Payment(this.client);
      this.preference = new Preference(this.client);
      this.preApproval = new PreApproval(this.client);
      this.preApprovalPlan = new PreApprovalPlan(this.client);
      this.webhookSecret = webhookSecret;
      this.initialized = true;

      logger.info('MercadoPago service initialized successfully');
    } else {
      logger.warn('MercadoPago credentials not configured. Payment features will be unavailable.');
    }
  }

  isConfigured(): boolean {
    return this.initialized && this.client !== null;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Payment service not configured' };
    }

    try {
      const paymentData = {
        transaction_amount: params.amount,
        description: params.description,
        payment_method_id: 'account_money',
        payer: {
          email: params.payerEmail,
          first_name: params.payerFirstName,
          last_name: params.payerLastName,
          phone: params.payerPhone ? { number: params.payerPhone } : undefined,
          identification: params.payerIdentification,
        },
        external_reference: params.externalReference,
        metadata: params.metadata,
        notification_url: config.mercadoPago.notificationUrl,
      };

      const response = await this.payment!.create({ body: paymentData });

      logger.info('Payment created', {
        paymentId: response.id,
        status: response.status,
        externalReference: params.externalReference,
      });

      return {
        success: true,
        paymentId: response.id,
        status: response.status,
        statusDetail: response.status_detail,
        externalReference: response.external_reference,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create payment', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  async createPreference(params: CreatePreferenceParams): Promise<PreferenceResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Payment service not configured' };
    }

    try {
      const preferenceData = {
        items: params.items.map((item) => ({
          title: item.title,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          currency_id: 'ARS',
          picture_url: item.pictureUrl,
        })),
        payer: params.payer ? {
          email: params.payer.email,
          name: params.payer.name,
          phone: params.payer.phone ? { number: params.payer.phone } : undefined,
        } : undefined,
        external_reference: params.externalReference,
        back_urls: params.backUrls,
        auto_return: params.autoReturn,
        notification_url: params.notificationUrl || config.mercadoPago.notificationUrl,
        metadata: params.metadata,
        expires: params.expires,
        expiration_date_from: params.expirationDateFrom?.toISOString(),
        expiration_date_to: params.expirationDateTo?.toISOString(),
        statement_descriptor: 'TURNOFACIL',
      };

      const response = await this.preference!.create({ body: preferenceData });

      logger.info('Preference created', {
        preferenceId: response.id,
        externalReference: params.externalReference,
      });

      return {
        success: true,
        preferenceId: response.id,
        initPoint: response.init_point,
        sandboxInitPoint: response.sandbox_init_point,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create preference', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  async getPayment(paymentId: number): Promise<PaymentResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Payment service not configured' };
    }

    try {
      const response = await this.payment!.get({ id: paymentId });

      return {
        success: true,
        paymentId: response.id,
        status: response.status,
        statusDetail: response.status_detail,
        externalReference: response.external_reference,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get payment', { error: errorMessage, paymentId });
      return { success: false, error: errorMessage };
    }
  }

  async refundPayment(params: RefundParams): Promise<RefundResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Payment service not configured' };
    }

    try {
      const refundData = params.amount ? { amount: params.amount } : {};

      const response = await this.payment!.refund({
        id: params.paymentId,
        body: refundData,
      });

      logger.info('Payment refunded', {
        paymentId: params.paymentId,
        refundId: response.id,
        amount: params.amount || 'full',
      });

      return {
        success: true,
        refundId: response.id,
        status: response.status,
        amount: response.amount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to refund payment', { error: errorMessage, paymentId: params.paymentId });
      return { success: false, error: errorMessage };
    }
  }

  async createSubscriptionPlan(params: CreateSubscriptionPlanParams): Promise<SubscriptionPlanResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Payment service not configured' };
    }

    try {
      const planData = {
        reason: params.reason,
        auto_recurring: {
          frequency: params.autoRecurring.frequency,
          frequency_type: params.autoRecurring.frequencyType,
          transaction_amount: params.autoRecurring.transactionAmount,
          currency_id: params.autoRecurring.currencyId || 'ARS',
        },
        back_url: params.backUrl,
      };

      const response = await this.preApprovalPlan!.create({ body: planData });

      logger.info('Subscription plan created', {
        planId: response.id,
        reason: params.reason,
      });

      return {
        success: true,
        planId: response.id,
        initPoint: response.init_point,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create subscription plan', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  async createSubscription(params: CreateSubscriptionParams): Promise<SubscriptionResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Payment service not configured' };
    }

    try {
      const subscriptionData = {
        preapproval_plan_id: params.preapprovalPlanId,
        payer_email: params.payerEmail,
        external_reference: params.externalReference,
        reason: params.reason,
        back_url: params.backUrl,
      };

      const response = await this.preApproval!.create({ body: subscriptionData });

      logger.info('Subscription created', {
        subscriptionId: response.id,
        status: response.status,
        externalReference: params.externalReference,
      });

      return {
        success: true,
        subscriptionId: response.id,
        status: response.status,
        initPoint: response.init_point,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create subscription', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Payment service not configured' };
    }

    try {
      await this.preApproval!.update({
        id: subscriptionId,
        body: { status: 'cancelled' },
      });

      logger.info('Subscription cancelled', { subscriptionId });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to cancel subscription', { error: errorMessage, subscriptionId });
      return { success: false, error: errorMessage };
    }
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Payment service not configured' };
    }

    try {
      const response = await this.preApproval!.get({ id: subscriptionId });

      return {
        success: true,
        subscriptionId: response.id,
        status: response.status,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get subscription', { error: errorMessage, subscriptionId });
      return { success: false, error: errorMessage };
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      logger.warn('Webhook secret not configured. Skipping signature verification.');
      return true;
    }

    try {
      const parts = signature.split(',');
      const tsValue = parts.find(p => p.startsWith('ts='))?.split('=')[1];
      const v1Value = parts.find(p => p.startsWith('v1='))?.split('=')[1];

      if (!tsValue || !v1Value) {
        logger.warn('Invalid webhook signature format');
        return false;
      }

      const signedPayload = `${tsValue}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(signedPayload)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(v1Value),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        logger.warn('Webhook signature verification failed');
      }

      return isValid;
    } catch (error) {
      logger.error('Error verifying webhook signature', { error });
      return false;
    }
  }

  parseWebhookPayload(payload: WebhookPayload): {
    type: string;
    action: string;
    resourceId: string;
    liveMode: boolean;
  } {
    return {
      type: payload.type,
      action: payload.action,
      resourceId: payload.data.id,
      liveMode: payload.live_mode,
    };
  }

  getPublicKey(): string | undefined {
    return config.mercadoPago.publicKey;
  }
}

export const mercadoPagoService = new MercadoPagoService();
