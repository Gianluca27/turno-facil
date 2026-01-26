import { Worker, Job } from 'bullmq';
import config from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import { User } from '../../database/mongodb/models/User.js';
import { Business } from '../../database/mongodb/models/Business.js';
import { Appointment } from '../../database/mongodb/models/Appointment.js';
import { Notification, IDeliveryResult } from '../../database/mongodb/models/Notification.js';
import {
  QUEUE_NAMES,
  NotificationJobData,
  addJob,
  EmailJobData,
  PushJobData,
  SMSJobData,
} from '../queues.js';
import { googleService } from '../../external/google/index.js';

let notificationWorker: Worker | null = null;

interface NotificationContent {
  title: string;
  body: string;
  email?: {
    subject: string;
    html?: string;
    templateId?: string;
    dynamicData?: Record<string, unknown>;
  };
  sms?: {
    body: string;
  };
  data?: Record<string, string>;
}

async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const { data } = job;

  logger.info(`Processing notification job ${job.id}`, {
    type: data.type,
    userId: data.userId,
    channels: data.channels,
  });

  try {
    // Get user
    const user = await User.findById(data.userId).select('email phone profile preferences devices');
    if (!user) {
      logger.warn(`User ${data.userId} not found for notification`);
      return;
    }

    // Get notification content based on type
    const content = await getNotificationContent(data);

    // Create notification record
    const notification = new Notification({
      userId: data.userId,
      type: data.type,
      title: content.title,
      body: content.body,
      data: data.data,
      channels: data.channels,
      businessId: data.businessId,
      appointmentId: data.appointmentId,
      status: 'pending',
    });
    await notification.save();

    const results: IDeliveryResult[] = [];

    // Send through each channel
    for (const channel of data.channels) {
      try {
        switch (channel) {
          case 'push':
            if (user.preferences.notifications.push && user.devices?.length > 0) {
              await addJob<PushJobData>(QUEUE_NAMES.PUSH, {
                userId: data.userId,
                title: content.title,
                body: content.body,
                data: content.data,
              });
              results.push({ channel: 'push', success: true });
            }
            break;

          case 'email':
            if (user.preferences.notifications.email && user.email) {
              if (content.email?.templateId) {
                await addJob<EmailJobData>(QUEUE_NAMES.EMAILS, {
                  to: user.email,
                  templateId: content.email.templateId,
                  dynamicTemplateData: content.email.dynamicData,
                });
              } else if (content.email?.html) {
                await addJob<EmailJobData>(QUEUE_NAMES.EMAILS, {
                  to: user.email,
                  subject: content.email.subject,
                  html: content.email.html,
                });
              }
              results.push({ channel: 'email', success: true });
            }
            break;

          case 'sms':
            if (user.preferences.notifications.sms && user.phone && content.sms) {
              await addJob<SMSJobData>(QUEUE_NAMES.SMS, {
                to: user.phone,
                body: content.sms.body,
              });
              results.push({ channel: 'sms', success: true });
            }
            break;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to send ${channel} notification`, { error: errorMessage });
        results.push({ channel, success: false, error: errorMessage });
      }
    }

    // Update notification status
    const allSucceeded = results.every(r => r.success);
    notification.status = allSucceeded ? 'sent' : 'partial';
    notification.sentAt = new Date();
    notification.deliveryResults = results;
    await notification.save();

    logger.info(`Notification job ${job.id} completed`, {
      results,
      notificationId: notification._id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Notification job ${job.id} failed`, { error: errorMessage });
    throw error;
  }
}

async function getNotificationContent(data: NotificationJobData): Promise<NotificationContent> {
  switch (data.type) {
    case 'booking_confirmed': {
      const appointment = data.appointmentId
        ? await Appointment.findById(data.appointmentId).populate('businessId')
        : null;

      const business = appointment?.businessId as unknown as { name: string; location: { address: string; city: string } } | null;
      const serviceName = appointment?.services[0]?.name || 'Servicio';
      const date = appointment ? formatDate(appointment.date) : '';
      const time = appointment?.startTime || '';

      return {
        title: '¡Turno Confirmado!',
        body: `Tu turno para ${serviceName} en ${business?.name || 'el negocio'} está confirmado para el ${date} a las ${time}`,
        email: {
          subject: `Turno confirmado en ${business?.name || 'TurnoFácil'}`,
          dynamicData: {
            businessName: business?.name,
            serviceName,
            date,
            time,
            address: business?.location?.address || '',
            ...data.data,
          },
        },
        sms: {
          body: `TurnoFácil: Tu turno en ${business?.name || 'el negocio'} está confirmado para el ${date} a las ${time}`,
        },
        data: {
          type: 'booking_confirmed',
          appointmentId: data.appointmentId || '',
          businessId: data.businessId || '',
        },
      };
    }

    case 'booking_cancelled': {
      const appointment = data.appointmentId
        ? await Appointment.findById(data.appointmentId).populate('businessId')
        : null;

      const business = appointment?.businessId as unknown as { name: string } | null;
      const serviceName = appointment?.services[0]?.name || 'Servicio';
      const date = appointment ? formatDate(appointment.date) : '';
      const time = appointment?.startTime || '';

      return {
        title: 'Turno Cancelado',
        body: `Tu turno para ${serviceName} del ${date} a las ${time} ha sido cancelado`,
        email: {
          subject: `Turno cancelado en ${business?.name || 'TurnoFácil'}`,
          dynamicData: {
            businessName: business?.name,
            serviceName,
            date,
            time,
            reason: data.data?.reason || '',
            ...data.data,
          },
        },
        sms: {
          body: `TurnoFácil: Tu turno en ${business?.name || 'el negocio'} del ${date} a las ${time} fue cancelado`,
        },
        data: {
          type: 'booking_cancelled',
          appointmentId: data.appointmentId || '',
        },
      };
    }

    case 'booking_reminder': {
      const appointment = data.appointmentId
        ? await Appointment.findById(data.appointmentId).populate('businessId')
        : null;

      const business = appointment?.businessId as unknown as { name: string; location: { address: string; city: string; coordinates: { coordinates: [number, number] } } } | null;
      const serviceName = appointment?.services[0]?.name || 'Servicio';
      const date = appointment ? formatDate(appointment.date) : '';
      const time = appointment?.startTime || '';

      const mapsUrl = business?.location?.coordinates?.coordinates
        ? googleService.generateDirectionsUrl(
            business.location.coordinates.coordinates[1],
            business.location.coordinates.coordinates[0]
          )
        : '';

      return {
        title: 'Recordatorio de Turno',
        body: `Recordá que tenés un turno para ${serviceName} mañana a las ${time}`,
        email: {
          subject: `Recordatorio: Tu turno en ${business?.name || 'TurnoFácil'}`,
          dynamicData: {
            businessName: business?.name,
            serviceName,
            date,
            time,
            address: business?.location?.address || '',
            mapsUrl,
            ...data.data,
          },
        },
        sms: {
          body: `TurnoFácil: Recordatorio - Tu turno en ${business?.name || 'el negocio'} es mañana a las ${time}. Dirección: ${business?.location?.address || ''}`,
        },
        data: {
          type: 'booking_reminder',
          appointmentId: data.appointmentId || '',
          businessId: data.businessId || '',
        },
      };
    }

    case 'booking_rescheduled': {
      const appointment = data.appointmentId
        ? await Appointment.findById(data.appointmentId).populate('businessId')
        : null;

      const business = appointment?.businessId as unknown as { name: string } | null;
      const date = appointment ? formatDate(appointment.date) : '';
      const time = appointment?.startTime || '';

      return {
        title: 'Turno Reprogramado',
        body: `Tu turno ha sido reprogramado para el ${date} a las ${time}`,
        email: {
          subject: `Turno reprogramado en ${business?.name || 'TurnoFácil'}`,
          dynamicData: {
            businessName: business?.name,
            date,
            time,
            ...data.data,
          },
        },
        sms: {
          body: `TurnoFácil: Tu turno en ${business?.name || 'el negocio'} fue reprogramado para el ${date} a las ${time}`,
        },
        data: {
          type: 'booking_rescheduled',
          appointmentId: data.appointmentId || '',
        },
      };
    }

    case 'review_request': {
      const business = data.businessId ? await Business.findById(data.businessId) : null;

      return {
        title: '¿Cómo fue tu experiencia?',
        body: `Contanos cómo fue tu experiencia en ${business?.name || 'el negocio'}`,
        email: {
          subject: `¿Cómo fue tu experiencia en ${business?.name || 'el negocio'}?`,
          dynamicData: {
            businessName: business?.name,
            ...data.data,
          },
        },
        data: {
          type: 'review_request',
          appointmentId: data.appointmentId || '',
          businessId: data.businessId || '',
        },
      };
    }

    case 'promotion': {
      const business = data.businessId ? await Business.findById(data.businessId) : null;

      return {
        title: data.data?.title as string || '¡Nueva Promoción!',
        body: data.data?.body as string || `${business?.name || 'Un negocio'} tiene una promoción especial para vos`,
        email: {
          subject: data.data?.subject as string || `Promoción especial en ${business?.name || 'TurnoFácil'}`,
          dynamicData: {
            businessName: business?.name,
            ...data.data,
          },
        },
        data: {
          type: 'promotion',
          businessId: data.businessId || '',
          promotionId: data.data?.promotionId as string || '',
        },
      };
    }

    case 'general':
    default:
      return {
        title: data.data?.title as string || 'TurnoFácil',
        body: data.data?.body as string || 'Tenés una nueva notificación',
        email: data.data?.email
          ? {
              subject: data.data.subject as string || 'TurnoFácil',
              html: data.data.html as string,
            }
          : undefined,
        sms: data.data?.sms
          ? {
              body: data.data.smsBody as string || data.data?.body as string || '',
            }
          : undefined,
        data: {
          type: 'general',
          ...(data.data as Record<string, string>),
        },
      };
  }
}

function formatDate(date: Date): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const d = new Date(date);
  return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}`;
}

export function startNotificationWorker(): Worker {
  if (notificationWorker) {
    return notificationWorker;
  }

  notificationWorker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATIONS,
    processNotificationJob,
    {
      connection: {
        host: config.database.redis.host,
        port: config.database.redis.port,
        password: config.database.redis.password,
        db: config.database.redis.db,
      },
      concurrency: 10,
    }
  );

  notificationWorker.on('completed', (job) => {
    logger.debug(`Notification worker completed job ${job.id}`);
  });

  notificationWorker.on('failed', (job, error) => {
    logger.error(`Notification worker failed job ${job?.id}`, {
      error: error.message,
      attempts: job?.attemptsMade,
    });
  });

  notificationWorker.on('error', (error) => {
    logger.error('Notification worker error', { error: error.message });
  });

  logger.info('Notification worker started');

  return notificationWorker;
}

export function stopNotificationWorker(): Promise<void> {
  if (notificationWorker) {
    return notificationWorker.close().then(() => {
      notificationWorker = null;
      logger.info('Notification worker stopped');
    });
  }
  return Promise.resolve();
}

export function getNotificationWorker(): Worker | null {
  return notificationWorker;
}
