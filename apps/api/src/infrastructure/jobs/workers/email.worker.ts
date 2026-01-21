import { Worker, Job } from 'bullmq';
import config from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import { sendGridService } from '../../external/sendgrid/index.js';
import { QUEUE_NAMES, EmailJobData } from '../queues.js';

let emailWorker: Worker | null = null;

async function processEmailJob(job: Job<EmailJobData>): Promise<{ success: boolean; messageId?: string }> {
  const { data } = job;

  logger.info(`Processing email job ${job.id}`, {
    to: Array.isArray(data.to) ? data.to.length + ' recipients' : data.to,
    templateId: data.templateId,
    subject: data.subject,
  });

  try {
    let result;

    if (data.templateId && data.dynamicTemplateData) {
      // Send template email
      result = await sendGridService.sendTemplateEmail({
        to: data.to,
        templateId: data.templateId,
        dynamicTemplateData: data.dynamicTemplateData,
      });
    } else {
      // Send regular email
      result = await sendGridService.sendEmail({
        to: data.to,
        subject: data.subject || 'TurnoFácil',
        html: data.html,
        text: data.text,
      });
    }

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }

    logger.info(`Email job ${job.id} completed`, { messageId: result.messageId });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Email job ${job.id} failed`, { error: errorMessage });
    throw error;
  }
}

export function startEmailWorker(): Worker {
  if (emailWorker) {
    return emailWorker;
  }

  emailWorker = new Worker<EmailJobData>(
    QUEUE_NAMES.EMAILS,
    processEmailJob,
    {
      connection: {
        host: config.database.redis.host,
        port: config.database.redis.port,
        password: config.database.redis.password,
        db: config.database.redis.db,
      },
      concurrency: 5, // Process 5 emails concurrently
      limiter: {
        max: 100,
        duration: 60000, // Max 100 emails per minute
      },
    }
  );

  emailWorker.on('completed', (job, result) => {
    logger.debug(`Email worker completed job ${job.id}`, { result });
  });

  emailWorker.on('failed', (job, error) => {
    logger.error(`Email worker failed job ${job?.id}`, {
      error: error.message,
      attempts: job?.attemptsMade,
    });
  });

  emailWorker.on('error', (error) => {
    logger.error('Email worker error', { error: error.message });
  });

  logger.info('Email worker started');

  return emailWorker;
}

export function stopEmailWorker(): Promise<void> {
  if (emailWorker) {
    return emailWorker.close().then(() => {
      emailWorker = null;
      logger.info('Email worker stopped');
    });
  }
  return Promise.resolve();
}

export function getEmailWorker(): Worker | null {
  return emailWorker;
}
