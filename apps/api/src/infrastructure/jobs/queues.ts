import { Queue, QueueEvents, Job, ConnectionOptions } from 'bullmq';
import config from '../../config/index.js';
import { logger } from '../../utils/logger.js';

// Queue names
export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  EMAILS: 'emails',
  SMS: 'sms',
  PUSH: 'push',
  ANALYTICS: 'analytics',
  WEBHOOKS: 'webhooks',
  REMINDERS: 'reminders',
  REVIEWS: 'review-requests',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

// Job types
export interface NotificationJobData {
  type: 'booking_confirmed' | 'booking_cancelled' | 'booking_reminder' | 'booking_rescheduled' | 'review_request' | 'promotion' | 'general';
  userId: string;
  businessId?: string;
  appointmentId?: string;
  channels: ('push' | 'email' | 'sms')[];
  data: Record<string, unknown>;
  scheduledFor?: Date;
}

export interface EmailJobData {
  to: string | string[];
  templateId?: string;
  subject?: string;
  html?: string;
  text?: string;
  dynamicTemplateData?: Record<string, unknown>;
  priority?: 'high' | 'normal' | 'low';
}

export interface SMSJobData {
  to: string;
  body: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface PushJobData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  tokens?: string[];
  badge?: number;
}

export interface ReminderJobData {
  appointmentId: string;
  userId: string;
  businessId: string;
  reminderType: '24h' | '2h' | '1h';
}

export interface ReviewRequestJobData {
  appointmentId: string;
  userId: string;
  businessId: string;
  serviceName: string;
}

export interface AnalyticsJobData {
  event: string;
  userId?: string;
  businessId?: string;
  properties: Record<string, unknown>;
  timestamp: Date;
}

export interface WebhookJobData {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  retries?: number;
}

// Redis connection options
const getConnection = (): ConnectionOptions => ({
  host: config.database.redis.host,
  port: config.database.redis.port,
  password: config.database.redis.password,
  db: config.database.redis.db,
});

// Queue storage
const queues = new Map<QueueName, Queue>();
const queueEvents = new Map<QueueName, QueueEvents>();

// Create queue function
export function createQueue<T>(name: QueueName): Queue<T> {
  if (queues.has(name)) {
    return queues.get(name) as Queue<T>;
  }

  const queue = new Queue<T>(name, {
    connection: getConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    },
  });

  queue.on('error', (error) => {
    logger.error(`Queue ${name} error:`, { error: error.message });
  });

  queues.set(name, queue as Queue);

  // Create queue events for monitoring
  const events = new QueueEvents(name, { connection: getConnection() });

  events.on('completed', ({ jobId, returnvalue }) => {
    logger.debug(`Job ${jobId} completed`, { queue: name, returnvalue });
  });

  events.on('failed', ({ jobId, failedReason }) => {
    logger.error(`Job ${jobId} failed`, { queue: name, failedReason });
  });

  events.on('stalled', ({ jobId }) => {
    logger.warn(`Job ${jobId} stalled`, { queue: name });
  });

  queueEvents.set(name, events);

  logger.info(`Queue ${name} created`);

  return queue;
}

// Get queue function
export function getQueue<T>(name: QueueName): Queue<T> {
  if (!queues.has(name)) {
    return createQueue<T>(name);
  }
  return queues.get(name) as Queue<T>;
}

// Add job to queue
export async function addJob<T>(
  queueName: QueueName,
  data: T,
  options?: {
    delay?: number;
    priority?: number;
    jobId?: string;
    repeat?: {
      pattern?: string;
      every?: number;
      limit?: number;
    };
  }
): Promise<Job<T>> {
  const queue = getQueue<T>(queueName);

  const jobOptions = {
    delay: options?.delay,
    priority: options?.priority,
    jobId: options?.jobId,
    repeat: options?.repeat,
  };

  // Cast to any to satisfy BullMQ's strict typing while maintaining our type safety
  const job = await queue.add(queueName as any, data as any, jobOptions);

  logger.debug(`Job added to queue ${queueName}`, {
    jobId: job.id,
    delay: options?.delay,
  });

  return job as unknown as Job<T>;
}

// Schedule job for specific time
export async function scheduleJob<T>(
  queueName: QueueName,
  data: T,
  scheduledFor: Date
): Promise<Job<T>> {
  const delay = Math.max(0, scheduledFor.getTime() - Date.now());
  return addJob(queueName, data, { delay });
}

// Get all queues
export function getAllQueues(): Map<QueueName, Queue> {
  return queues;
}

// Close all queues
export async function closeAllQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  for (const [name, queue] of queues) {
    closePromises.push(
      queue.close().then(() => {
        logger.info(`Queue ${name} closed`);
      })
    );
  }

  for (const [name, events] of queueEvents) {
    closePromises.push(
      events.close().then(() => {
        logger.info(`QueueEvents ${name} closed`);
      })
    );
  }

  await Promise.all(closePromises);
  queues.clear();
  queueEvents.clear();
}

// Initialize all queues
export function initializeQueues(): void {
  Object.values(QUEUE_NAMES).forEach((name) => {
    createQueue(name);
  });

  logger.info('All queues initialized');
}

// Get queue stats
export async function getQueueStats(queueName: QueueName): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}> {
  const queue = getQueue(queueName);

  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.isPaused(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused: paused ? 1 : 0,
  };
}

// Pause queue
export async function pauseQueue(queueName: QueueName): Promise<void> {
  const queue = getQueue(queueName);
  await queue.pause();
  logger.info(`Queue ${queueName} paused`);
}

// Resume queue
export async function resumeQueue(queueName: QueueName): Promise<void> {
  const queue = getQueue(queueName);
  await queue.resume();
  logger.info(`Queue ${queueName} resumed`);
}

// Drain queue (remove all jobs)
export async function drainQueue(queueName: QueueName): Promise<void> {
  const queue = getQueue(queueName);
  await queue.drain();
  logger.info(`Queue ${queueName} drained`);
}

// Clean old jobs
export async function cleanQueue(
  queueName: QueueName,
  grace: number = 3600000, // 1 hour
  limit: number = 1000,
  status: 'completed' | 'failed' | 'delayed' | 'wait' | 'active' = 'completed'
): Promise<string[]> {
  const queue = getQueue(queueName);
  const removed = await queue.clean(grace, limit, status);
  logger.info(`Cleaned ${removed.length} jobs from queue ${queueName}`, { status });
  return removed;
}
