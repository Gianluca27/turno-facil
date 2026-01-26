import sgMail, { MailDataRequired } from '@sendgrid/mail';
import config from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';

export interface EmailParams {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

export interface TemplateEmailParams {
  to: string | string[];
  templateId: string;
  dynamicTemplateData: Record<string, unknown>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BookingConfirmedData {
  clientName: string;
  businessName: string;
  serviceName: string;
  date: string;
  time: string;
  staffName: string;
  address: string;
  price: string;
  bookingId: string;
  [key: string]: unknown;
}

export interface BookingCancelledData {
  clientName: string;
  businessName: string;
  serviceName: string;
  date: string;
  time: string;
  reason?: string;
  [key: string]: unknown;
}

export interface ReminderData {
  clientName: string;
  businessName: string;
  serviceName: string;
  date: string;
  time: string;
  address: string;
  mapsUrl: string;
  [key: string]: unknown;
}

export interface PasswordResetData {
  userName: string;
  resetLink: string;
  expiresIn: string;
  [key: string]: unknown;
}

export interface WelcomeData {
  userName: string;
  appStoreUrl?: string;
  playStoreUrl?: string;
  [key: string]: unknown;
}

export interface ReviewRequestData {
  clientName: string;
  businessName: string;
  serviceName: string;
  reviewLink: string;
  [key: string]: unknown;
}

class SendGridService {
  private initialized: boolean = false;
  private fromEmail: string;
  private fromName: string;
  private templates: typeof config.sendgrid.templates;

  constructor() {
    this.fromEmail = config.sendgrid.fromEmail;
    this.fromName = config.sendgrid.fromName;
    this.templates = config.sendgrid.templates;
    this.initialize();
  }

  private initialize(): void {
    const { apiKey } = config.sendgrid;

    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.initialized = true;
      logger.info('SendGrid service initialized successfully');
    } else {
      logger.warn('SendGrid API key not configured. Email features will be unavailable.');
    }
  }

  isConfigured(): boolean {
    return this.initialized;
  }

  async sendEmail(params: EmailParams): Promise<EmailResult> {
    if (!this.isConfigured()) {
      logger.warn('SendGrid not configured. Email not sent.', { to: params.to });
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const msg: MailDataRequired = {
        to: params.to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject: params.subject,
        text: params.text || '',
        html: params.html || params.text || '',
      };

      const response = await sgMail.send(msg);
      const messageId = response[0]?.headers?.['x-message-id'];

      logger.info('Email sent successfully', {
        to: params.to,
        subject: params.subject,
        messageId
      });

      return { success: true, messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send email', { error: errorMessage, to: params.to });
      return { success: false, error: errorMessage };
    }
  }

  async sendTemplateEmail(params: TemplateEmailParams): Promise<EmailResult> {
    if (!this.isConfigured()) {
      logger.warn('SendGrid not configured. Template email not sent.', { to: params.to });
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const msg: MailDataRequired = {
        to: params.to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        templateId: params.templateId,
        dynamicTemplateData: params.dynamicTemplateData,
      };

      const response = await sgMail.send(msg);
      const messageId = response[0]?.headers?.['x-message-id'];

      logger.info('Template email sent successfully', {
        to: params.to,
        templateId: params.templateId,
        messageId
      });

      return { success: true, messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send template email', {
        error: errorMessage,
        to: params.to,
        templateId: params.templateId
      });
      return { success: false, error: errorMessage };
    }
  }

  async sendBookingConfirmed(to: string, data: BookingConfirmedData): Promise<EmailResult> {
    const templateId = this.templates.bookingConfirmed;

    if (!templateId) {
      return this.sendEmail({
        to,
        subject: `Turno confirmado en ${data.businessName}`,
        html: this.generateBookingConfirmedHtml(data),
      });
    }

    return this.sendTemplateEmail({
      to,
      templateId,
      dynamicTemplateData: data,
    });
  }

  async sendBookingCancelled(to: string, data: BookingCancelledData): Promise<EmailResult> {
    const templateId = this.templates.bookingCancelled;

    if (!templateId) {
      return this.sendEmail({
        to,
        subject: `Turno cancelado en ${data.businessName}`,
        html: this.generateBookingCancelledHtml(data),
      });
    }

    return this.sendTemplateEmail({
      to,
      templateId,
      dynamicTemplateData: data,
    });
  }

  async sendReminder(to: string, data: ReminderData): Promise<EmailResult> {
    const templateId = this.templates.reminder;

    if (!templateId) {
      return this.sendEmail({
        to,
        subject: `Recordatorio: Tu turno en ${data.businessName}`,
        html: this.generateReminderHtml(data),
      });
    }

    return this.sendTemplateEmail({
      to,
      templateId,
      dynamicTemplateData: data,
    });
  }

  async sendPasswordReset(to: string, data: PasswordResetData): Promise<EmailResult> {
    const templateId = this.templates.passwordReset;

    if (!templateId) {
      return this.sendEmail({
        to,
        subject: 'Restablecer contraseña - TurnoFácil',
        html: this.generatePasswordResetHtml(data),
      });
    }

    return this.sendTemplateEmail({
      to,
      templateId,
      dynamicTemplateData: data,
    });
  }

  async sendWelcome(to: string, data: WelcomeData): Promise<EmailResult> {
    const templateId = this.templates.welcome;

    if (!templateId) {
      return this.sendEmail({
        to,
        subject: '¡Bienvenido a TurnoFácil!',
        html: this.generateWelcomeHtml(data),
      });
    }

    return this.sendTemplateEmail({
      to,
      templateId,
      dynamicTemplateData: data,
    });
  }

  async sendReviewRequest(to: string, data: ReviewRequestData): Promise<EmailResult> {
    const templateId = this.templates.reviewRequest;

    if (!templateId) {
      return this.sendEmail({
        to,
        subject: `¿Cómo fue tu experiencia en ${data.businessName}?`,
        html: this.generateReviewRequestHtml(data),
      });
    }

    return this.sendTemplateEmail({
      to,
      templateId,
      dynamicTemplateData: data,
    });
  }

  async sendBulkEmails(emails: EmailParams[]): Promise<EmailResult[]> {
    if (!this.isConfigured()) {
      return emails.map(() => ({ success: false, error: 'Email service not configured' }));
    }

    const results = await Promise.allSettled(
      emails.map(email => this.sendEmail(email))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      logger.error('Bulk email failed', {
        index,
        to: emails[index].to,
        error: result.reason
      });
      return { success: false, error: result.reason?.message || 'Unknown error' };
    });
  }

  private generateBookingConfirmedHtml(data: BookingConfirmedData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Turno Confirmado</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">¡Turno Confirmado!</h1>
        </div>
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="margin-top: 0;">Hola <strong>${data.clientName}</strong>,</p>
          <p>Tu turno ha sido confirmado exitosamente.</p>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #667eea;">${data.businessName}</h3>
            <p style="margin: 10px 0;"><strong>Servicio:</strong> ${data.serviceName}</p>
            <p style="margin: 10px 0;"><strong>Fecha:</strong> ${data.date}</p>
            <p style="margin: 10px 0;"><strong>Hora:</strong> ${data.time}</p>
            <p style="margin: 10px 0;"><strong>Profesional:</strong> ${data.staffName}</p>
            <p style="margin: 10px 0;"><strong>Dirección:</strong> ${data.address}</p>
            <p style="margin: 10px 0;"><strong>Precio:</strong> ${data.price}</p>
          </div>

          <p style="font-size: 14px; color: #666;">
            Si necesitás cancelar o reprogramar tu turno, podés hacerlo desde la app hasta 24 horas antes.
          </p>

          <p style="margin-bottom: 0;">¡Te esperamos!</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p>Este email fue enviado por TurnoFácil</p>
        </div>
      </body>
      </html>
    `;
  }

  private generateBookingCancelledHtml(data: BookingCancelledData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Turno Cancelado</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #e74c3c; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Turno Cancelado</h1>
        </div>
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="margin-top: 0;">Hola <strong>${data.clientName}</strong>,</p>
          <p>Tu turno ha sido cancelado.</p>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c;">
            <h3 style="margin-top: 0;">${data.businessName}</h3>
            <p style="margin: 10px 0;"><strong>Servicio:</strong> ${data.serviceName}</p>
            <p style="margin: 10px 0;"><strong>Fecha:</strong> ${data.date}</p>
            <p style="margin: 10px 0;"><strong>Hora:</strong> ${data.time}</p>
            ${data.reason ? `<p style="margin: 10px 0;"><strong>Motivo:</strong> ${data.reason}</p>` : ''}
          </div>

          <p>Podés agendar un nuevo turno cuando quieras desde la app.</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p>Este email fue enviado por TurnoFácil</p>
        </div>
      </body>
      </html>
    `;
  }

  private generateReminderHtml(data: ReminderData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recordatorio de Turno</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Recordatorio de Turno</h1>
        </div>
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="margin-top: 0;">Hola <strong>${data.clientName}</strong>,</p>
          <p>Te recordamos que tenés un turno próximamente:</p>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f5576c;">
            <h3 style="margin-top: 0;">${data.businessName}</h3>
            <p style="margin: 10px 0;"><strong>Servicio:</strong> ${data.serviceName}</p>
            <p style="margin: 10px 0;"><strong>Fecha:</strong> ${data.date}</p>
            <p style="margin: 10px 0;"><strong>Hora:</strong> ${data.time}</p>
            <p style="margin: 10px 0;"><strong>Dirección:</strong> ${data.address}</p>
          </div>

          <div style="text-align: center; margin: 20px 0;">
            <a href="${data.mapsUrl}" style="display: inline-block; background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Ver en Google Maps
            </a>
          </div>

          <p style="margin-bottom: 0;">¡Te esperamos!</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p>Este email fue enviado por TurnoFácil</p>
        </div>
      </body>
      </html>
    `;
  }

  private generatePasswordResetHtml(data: PasswordResetData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecer Contraseña</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #2c3e50; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Restablecer Contraseña</h1>
        </div>
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="margin-top: 0;">Hola <strong>${data.userName}</strong>,</p>
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.resetLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Restablecer Contraseña
            </a>
          </div>

          <p style="font-size: 14px; color: #666;">
            Este enlace expira en <strong>${data.expiresIn}</strong>.
          </p>

          <p style="font-size: 14px; color: #666;">
            Si no solicitaste restablecer tu contraseña, podés ignorar este email.
          </p>
        </div>
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p>Este email fue enviado por TurnoFácil</p>
        </div>
      </body>
      </html>
    `;
  }

  private generateWelcomeHtml(data: WelcomeData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenido a TurnoFácil</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">¡Bienvenido a TurnoFácil!</h1>
        </div>
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="margin-top: 0; font-size: 18px;">Hola <strong>${data.userName}</strong>,</p>
          <p>¡Gracias por unirte a TurnoFácil! Estamos encantados de tenerte.</p>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">¿Qué podés hacer?</h3>
            <ul style="padding-left: 20px;">
              <li style="margin: 10px 0;">Buscar y reservar turnos en tus negocios favoritos</li>
              <li style="margin: 10px 0;">Recibir recordatorios automáticos</li>
              <li style="margin: 10px 0;">Guardar tus profesionales favoritos</li>
              <li style="margin: 10px 0;">Acceder a promociones exclusivas</li>
            </ul>
          </div>

          <p>¡Empezá a explorar y reservá tu primer turno!</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p>Este email fue enviado por TurnoFácil</p>
        </div>
      </body>
      </html>
    `;
  }

  private generateReviewRequestHtml(data: ReviewRequestData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¿Cómo fue tu experiencia?</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">¿Cómo fue tu experiencia?</h1>
        </div>
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="margin-top: 0;">Hola <strong>${data.clientName}</strong>,</p>
          <p>Esperamos que hayas tenido una excelente experiencia en <strong>${data.businessName}</strong>.</p>

          <p>Tu opinión es muy importante. ¿Podrías dejarnos una reseña sobre tu servicio de <strong>${data.serviceName}</strong>?</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.reviewLink}" style="display: inline-block; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Dejar Reseña
            </a>
          </div>

          <p style="font-size: 14px; color: #666;">
            Solo te tomará un minuto y ayudará a otros usuarios a encontrar los mejores servicios.
          </p>
        </div>
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p>Este email fue enviado por TurnoFácil</p>
        </div>
      </body>
      </html>
    `;
  }
}

export const sendGridService = new SendGridService();
