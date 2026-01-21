import { logger } from '../../utils/logger.js';
import { initializeQueues, closeAllQueues } from './queues.js';
import {
  startEmailWorker,
  stopEmailWorker,
  startPushWorker,
  stopPushWorker,
  startSMSWorker,
  stopSMSWorker,
  startNotificationWorker,
  stopNotificationWorker,
  startReminderWorker,
  stopReminderWorker,
} from './workers/index.js';

// Export queues
export * from './queues.js';

// Export workers
export * from './workers/index.js';

// Initialize all job infrastructure
export async function initializeJobs(): Promise<void> {
  try {
    // Initialize queues first
    initializeQueues();

    // Start all workers
    startEmailWorker();
    startPushWorker();
    startSMSWorker();
    startNotificationWorker();
    startReminderWorker();

    logger.info('Job infrastructure initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize job infrastructure', { error });
    throw error;
  }
}

// Gracefully shutdown all jobs
export async function shutdownJobs(): Promise<void> {
  try {
    // Stop all workers first
    await Promise.all([
      stopEmailWorker(),
      stopPushWorker(),
      stopSMSWorker(),
      stopNotificationWorker(),
      stopReminderWorker(),
    ]);

    // Close all queues
    await closeAllQueues();

    logger.info('Job infrastructure shutdown successfully');
  } catch (error) {
    logger.error('Error shutting down job infrastructure', { error });
    throw error;
  }
}
