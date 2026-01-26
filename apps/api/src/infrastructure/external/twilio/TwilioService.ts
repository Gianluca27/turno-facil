import twilio from 'twilio';
import config from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';

export interface SendSMSParams {
  to: string;
  body: string;
}

export interface SendOTPParams {
  phone: string;
  channel?: 'sms' | 'whatsapp' | 'call';
}

export interface VerifyOTPParams {
  phone: string;
  code: string;
}

export interface SMSResult {
  success: boolean;
  sid?: string;
  status?: string;
  error?: string;
}

export interface OTPResult {
  success: boolean;
  status?: string;
  valid?: boolean;
  error?: string;
}

class TwilioService {
  private client: twilio.Twilio | null = null;
  private verifyServiceSid: string | undefined;
  private fromNumber: string | undefined;
  private initialized: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const { accountSid, authToken, verifyServiceSid, fromNumber } = config.twilio;

    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
      this.verifyServiceSid = verifyServiceSid;
      this.fromNumber = fromNumber;
      this.initialized = true;
      logger.info('Twilio service initialized successfully');
    } else {
      logger.warn('Twilio credentials not configured. SMS and OTP features will be unavailable.');
    }
  }

  isConfigured(): boolean {
    return this.initialized && this.client !== null;
  }

  async sendSMS(params: SendSMSParams): Promise<SMSResult> {
    if (!this.isConfigured()) {
      logger.warn('Twilio not configured. SMS not sent.', { to: params.to });
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      const normalizedPhone = this.normalizePhoneNumber(params.to);

      const message = await this.client!.messages.create({
        to: normalizedPhone,
        from: this.fromNumber,
        body: params.body,
      });

      logger.info('SMS sent successfully', {
        sid: message.sid,
        to: normalizedPhone,
        status: message.status
      });

      return {
        success: true,
        sid: message.sid,
        status: message.status,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send SMS', { error: errorMessage, to: params.to });
      return { success: false, error: errorMessage };
    }
  }

  async sendOTP(params: SendOTPParams): Promise<OTPResult> {
    if (!this.isConfigured() || !this.verifyServiceSid) {
      logger.warn('Twilio Verify not configured. OTP not sent.', { phone: params.phone });
      return { success: false, error: 'OTP service not configured' };
    }

    try {
      const normalizedPhone = this.normalizePhoneNumber(params.phone);
      const channel = params.channel || 'sms';

      const verification = await this.client!.verify.v2
        .services(this.verifyServiceSid)
        .verifications.create({
          to: normalizedPhone,
          channel,
        });

      logger.info('OTP sent successfully', {
        phone: normalizedPhone,
        channel,
        status: verification.status
      });

      return {
        success: true,
        status: verification.status,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send OTP', { error: errorMessage, phone: params.phone });
      return { success: false, error: errorMessage };
    }
  }

  async verifyOTP(params: VerifyOTPParams): Promise<OTPResult> {
    if (!this.isConfigured() || !this.verifyServiceSid) {
      logger.warn('Twilio Verify not configured. OTP verification unavailable.');
      return { success: false, error: 'OTP service not configured' };
    }

    try {
      const normalizedPhone = this.normalizePhoneNumber(params.phone);

      const verificationCheck = await this.client!.verify.v2
        .services(this.verifyServiceSid)
        .verificationChecks.create({
          to: normalizedPhone,
          code: params.code,
        });

      const isValid = verificationCheck.status === 'approved';

      logger.info('OTP verification completed', {
        phone: normalizedPhone,
        valid: isValid,
        status: verificationCheck.status
      });

      return {
        success: true,
        valid: isValid,
        status: verificationCheck.status,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to verify OTP', { error: errorMessage, phone: params.phone });

      if (errorMessage.includes('VerificationCheck was not found')) {
        return { success: false, valid: false, error: 'Invalid or expired OTP' };
      }

      return { success: false, error: errorMessage };
    }
  }

  async sendWhatsAppMessage(params: SendSMSParams): Promise<SMSResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'WhatsApp service not configured' };
    }

    try {
      const normalizedPhone = this.normalizePhoneNumber(params.to);

      const message = await this.client!.messages.create({
        to: `whatsapp:${normalizedPhone}`,
        from: `whatsapp:${this.fromNumber}`,
        body: params.body,
      });

      logger.info('WhatsApp message sent', { sid: message.sid, to: normalizedPhone });

      return {
        success: true,
        sid: message.sid,
        status: message.status,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send WhatsApp message', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private normalizePhoneNumber(phone: string): string {
    let normalized = phone.replace(/[\s\-\(\)]/g, '');

    if (!normalized.startsWith('+')) {
      if (normalized.startsWith('0')) {
        normalized = normalized.substring(1);
      }
      normalized = '+54' + normalized;
    }

    return normalized;
  }

  async sendBulkSMS(messages: SendSMSParams[]): Promise<SMSResult[]> {
    if (!this.isConfigured()) {
      return messages.map(() => ({ success: false, error: 'SMS service not configured' }));
    }

    const results = await Promise.allSettled(
      messages.map(msg => this.sendSMS(msg))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      logger.error('Bulk SMS failed for message', {
        index,
        to: messages[index].to,
        error: result.reason
      });
      return { success: false, error: result.reason?.message || 'Unknown error' };
    });
  }
}

export const twilioService = new TwilioService();
