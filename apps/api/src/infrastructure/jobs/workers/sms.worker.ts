import { Worker, Job } from 'bullmq';
import config from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import { twilioService } from '../../external/twilio/index.js';
import { QUEUE_NAMES, SMSJobData } from '../queues.js';

let smsWorker: Worker | null = null;

async function processSMSJob(job: Job<SMSJobData>): Promise<{ success: boolean; sid?: string }> {
  const { data } = job;

  logger.info(`Processing SMS job ${job.id}`, {
    to: data.to.replace(/(\d{2})\d+(\d{2})/, '$1****$2'),
    priority: data.priority,
  });

  try {
    const result = await twilioService.sendSMS({
      to: data.to,
      body: data.body,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to send SMS');
    }

    logger.info(`SMS job ${job.id} completed`, { sid: result.sid });

    return { success: true, sid: result.sid };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`SMS job ${job.id} failed`, { error: errorMessage });
    throw error;
  }
}

export function startSMSWorker(): Worker {
  if (smsWorker) {
    return smsWorker;
  }

  smsWorker = new Worker<SMSJobData>(
    QUEUE_NAMES.SMS,
    processSMSJob,
    {
      connection: {
        host: config.database.redis.host,
        port: config.database.redis.port,
        password: config.database.redis.password,
        db: config.database.redis.db,
      },
      concurrency: 3, // Process 3 SMS concurrently
      limiter: {
        max: 30,
        duration: 60000, // Max 30 SMS per minute (Twilio free tier limits)
      },
    }
  );

  smsWorker.on('completed', (job, result) => {
    logger.debug(`SMS worker completed job ${job.id}`, { result });
  });

  smsWorker.on('failed', (job, error) => {
    logger.error(`SMS worker failed job ${job?.id}`, {
      error: error.message,
      attempts: job?.attemptsMade,
    });
  });

  smsWorker.on('error', (error) => {
    logger.error('SMS worker error', { error: error.message });
  });

  logger.info('SMS worker started');

  return smsWorker;
}

export function stopSMSWorker(): Promise<void> {
  if (smsWorker) {
    return smsWorker.close().then(() => {
      smsWorker = null;
      logger.info('SMS worker stopped');
    });
  }
  return Promise.resolve();
}

export function getSMSWorker(): Worker | null {
  return smsWorker;
}
