import { Worker, Job } from 'bullmq';
import config from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import { Appointment } from '../../database/mongodb/models/Appointment.js';
import { QUEUE_NAMES, ReminderJobData, NotificationJobData, addJob } from '../queues.js';

let reminderWorker: Worker | null = null;

async function processReminderJob(job: Job<ReminderJobData>): Promise<void> {
  const { data } = job;

  logger.info(`Processing reminder job ${job.id}`, {
    appointmentId: data.appointmentId,
    reminderType: data.reminderType,
  });

  try {
    // Verify appointment still exists and is valid
    const appointment = await Appointment.findById(data.appointmentId);

    if (!appointment) {
      logger.warn(`Appointment ${data.appointmentId} not found for reminder`);
      return;
    }

    // Check if appointment is still in a valid state for reminder
    if (!['pending', 'confirmed'].includes(appointment.status)) {
      logger.info(`Skipping reminder for appointment ${data.appointmentId} with status ${appointment.status}`);
      return;
    }

    // Check if appointment is still in the future
    if (appointment.startDateTime <= new Date()) {
      logger.info(`Skipping reminder for past appointment ${data.appointmentId}`);
      return;
    }

    // Send notification through the notification queue
    await addJob<NotificationJobData>(QUEUE_NAMES.NOTIFICATIONS, {
      type: 'booking_reminder',
      userId: data.userId,
      businessId: data.businessId,
      appointmentId: data.appointmentId,
      channels: ['push', 'email'],
      data: {
        reminderType: data.reminderType,
      },
    });

    logger.info(`Reminder job ${job.id} completed`, {
      appointmentId: data.appointmentId,
      reminderType: data.reminderType,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Reminder job ${job.id} failed`, { error: errorMessage });
    throw error;
  }
}

export function startReminderWorker(): Worker {
  if (reminderWorker) {
    return reminderWorker;
  }

  reminderWorker = new Worker<ReminderJobData>(
    QUEUE_NAMES.REMINDERS,
    processReminderJob,
    {
      connection: {
        host: config.database.redis.host,
        port: config.database.redis.port,
        password: config.database.redis.password,
        db: config.database.redis.db,
      },
      concurrency: 5,
    }
  );

  reminderWorker.on('completed', (job) => {
    logger.debug(`Reminder worker completed job ${job.id}`);
  });

  reminderWorker.on('failed', (job, error) => {
    logger.error(`Reminder worker failed job ${job?.id}`, {
      error: error.message,
      attempts: job?.attemptsMade,
    });
  });

  reminderWorker.on('error', (error) => {
    logger.error('Reminder worker error', { error: error.message });
  });

  logger.info('Reminder worker started');

  return reminderWorker;
}

export function stopReminderWorker(): Promise<void> {
  if (reminderWorker) {
    return reminderWorker.close().then(() => {
      reminderWorker = null;
      logger.info('Reminder worker stopped');
    });
  }
  return Promise.resolve();
}

export function getReminderWorker(): Worker | null {
  return reminderWorker;
}

// Schedule reminders for an appointment
export async function scheduleAppointmentReminders(appointment: {
  _id: string;
  clientId: string;
  businessId: string;
  startDateTime: Date;
}): Promise<void> {
  const now = new Date();
  const appointmentTime = new Date(appointment.startDateTime);

  // Calculate reminder times
  const reminder24h = new Date(appointmentTime.getTime() - 24 * 60 * 60 * 1000);
  const reminder2h = new Date(appointmentTime.getTime() - 2 * 60 * 60 * 1000);
  const reminder1h = new Date(appointmentTime.getTime() - 1 * 60 * 60 * 1000);

  const baseJobData: Omit<ReminderJobData, 'reminderType'> = {
    appointmentId: appointment._id.toString(),
    userId: appointment.clientId.toString(),
    businessId: appointment.businessId.toString(),
  };

  // Schedule 24-hour reminder if appointment is more than 24 hours away
  if (reminder24h > now) {
    const delay = reminder24h.getTime() - now.getTime();
    await addJob<ReminderJobData>(
      QUEUE_NAMES.REMINDERS,
      { ...baseJobData, reminderType: '24h' },
      { delay, jobId: `reminder-24h-${appointment._id}` }
    );
    logger.debug('Scheduled 24h reminder', { appointmentId: appointment._id, scheduledFor: reminder24h });
  }

  // Schedule 2-hour reminder if appointment is more than 2 hours away
  if (reminder2h > now) {
    const delay = reminder2h.getTime() - now.getTime();
    await addJob<ReminderJobData>(
      QUEUE_NAMES.REMINDERS,
      { ...baseJobData, reminderType: '2h' },
      { delay, jobId: `reminder-2h-${appointment._id}` }
    );
    logger.debug('Scheduled 2h reminder', { appointmentId: appointment._id, scheduledFor: reminder2h });
  }

  // Schedule 1-hour reminder if appointment is more than 1 hour away
  if (reminder1h > now) {
    const delay = reminder1h.getTime() - now.getTime();
    await addJob<ReminderJobData>(
      QUEUE_NAMES.REMINDERS,
      { ...baseJobData, reminderType: '1h' },
      { delay, jobId: `reminder-1h-${appointment._id}` }
    );
    logger.debug('Scheduled 1h reminder', { appointmentId: appointment._id, scheduledFor: reminder1h });
  }
}

// Cancel reminders for an appointment
export async function cancelAppointmentReminders(appointmentId: string): Promise<void> {
  const queue = await import('../queues.js').then(m => m.getQueue(QUEUE_NAMES.REMINDERS));

  const jobIds = [
    `reminder-24h-${appointmentId}`,
    `reminder-2h-${appointmentId}`,
    `reminder-1h-${appointmentId}`,
  ];

  for (const jobId of jobIds) {
    try {
      const job = await queue.getJob(jobId);
      if (job) {
        await job.remove();
        logger.debug('Cancelled reminder', { jobId, appointmentId });
      }
    } catch (error) {
      logger.warn('Failed to cancel reminder', { jobId, error });
    }
  }
}
