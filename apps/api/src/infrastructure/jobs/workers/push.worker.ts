import { Worker, Job } from 'bullmq';
import config from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import { firebaseService } from '../../external/firebase/index.js';
import { User } from '../../database/mongodb/models/User.js';
import { QUEUE_NAMES, PushJobData } from '../queues.js';

let pushWorker: Worker | null = null;

async function processPushJob(job: Job<PushJobData>): Promise<{ success: boolean; failedTokens?: string[] }> {
  const { data } = job;

  logger.info(`Processing push job ${job.id}`, {
    userId: data.userId,
    title: data.title,
    hasTokens: !!data.tokens?.length,
  });

  try {
    let tokens = data.tokens;

    // If no tokens provided, get from user's devices
    if (!tokens || tokens.length === 0) {
      const user = await User.findById(data.userId).select('devices');

      if (!user || !user.devices || user.devices.length === 0) {
        logger.warn(`No devices found for user ${data.userId}`);
        return { success: true }; // Not a failure, user just doesn't have devices
      }

      tokens = user.devices.map(d => d.fcmToken).filter(Boolean);
    }

    if (tokens.length === 0) {
      logger.warn(`No FCM tokens for push notification`, { userId: data.userId });
      return { success: true };
    }

    // Send multicast if multiple tokens
    if (tokens.length > 1) {
      const result = await firebaseService.sendMulticast({
        tokens,
        title: data.title,
        body: data.body,
        data: data.data,
        imageUrl: data.imageUrl,
      });

      // Remove invalid tokens from user's devices
      if (result.failedTokens && result.failedTokens.length > 0) {
        await removeInvalidTokens(data.userId, result.failedTokens);
      }

      logger.info(`Push job ${job.id} completed`, {
        sent: tokens.length - (result.failedTokens?.length || 0),
        failed: result.failedTokens?.length || 0,
      });

      return { success: result.success, failedTokens: result.failedTokens };
    }

    // Send single notification
    const result = await firebaseService.sendPushNotification({
      token: tokens[0],
      title: data.title,
      body: data.body,
      data: data.data,
      imageUrl: data.imageUrl,
      badge: data.badge,
    });

    if (result.failedTokens && result.failedTokens.length > 0) {
      await removeInvalidTokens(data.userId, result.failedTokens);
    }

    logger.info(`Push job ${job.id} completed`, { messageId: result.messageId });

    return { success: result.success, failedTokens: result.failedTokens };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Push job ${job.id} failed`, { error: errorMessage });
    throw error;
  }
}

async function removeInvalidTokens(userId: string, invalidTokens: string[]): Promise<void> {
  try {
    await User.findByIdAndUpdate(userId, {
      $pull: {
        devices: {
          fcmToken: { $in: invalidTokens },
        },
      },
    });
    logger.info(`Removed ${invalidTokens.length} invalid FCM tokens`, { userId });
  } catch (error) {
    logger.error('Failed to remove invalid tokens', { userId, error });
  }
}

export function startPushWorker(): Worker {
  if (pushWorker) {
    return pushWorker;
  }

  pushWorker = new Worker<PushJobData>(
    QUEUE_NAMES.PUSH,
    processPushJob,
    {
      connection: {
        host: config.database.redis.host,
        port: config.database.redis.port,
        password: config.database.redis.password,
        db: config.database.redis.db,
      },
      concurrency: 10, // Process 10 push notifications concurrently
      limiter: {
        max: 500,
        duration: 60000, // Max 500 pushes per minute
      },
    }
  );

  pushWorker.on('completed', (job, result) => {
    logger.debug(`Push worker completed job ${job.id}`, { result });
  });

  pushWorker.on('failed', (job, error) => {
    logger.error(`Push worker failed job ${job?.id}`, {
      error: error.message,
      attempts: job?.attemptsMade,
    });
  });

  pushWorker.on('error', (error) => {
    logger.error('Push worker error', { error: error.message });
  });

  logger.info('Push worker started');

  return pushWorker;
}

export function stopPushWorker(): Promise<void> {
  if (pushWorker) {
    return pushWorker.close().then(() => {
      pushWorker = null;
      logger.info('Push worker stopped');
    });
  }
  return Promise.resolve();
}

export function getPushWorker(): Worker | null {
  return pushWorker;
}
