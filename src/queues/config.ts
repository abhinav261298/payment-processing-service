import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { WebhookEvent } from '../types/database';

// Redis connection configuration
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Queue names
export enum QueueName {
  WEBHOOK_EVENTS = 'webhook_events',
}

// Queue configuration
export const queueConfig = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s, 2s, 4s, etc.
    },
    removeOnComplete: 1000, // Keep last 1000 jobs
    removeOnFail: 5000, // Keep last 5000 failed jobs
  },
};

// Initialize queues
export const webhookQueue = new Queue<WebhookEvent>(QueueName.WEBHOOK_EVENTS, queueConfig);

// Note: BullMQ v5 no longer requires a separate QueueScheduler; delays are handled internally.

// Graceful shutdown
process.on('SIGTERM', async () => {
  await webhookQueue.close();
  await connection.quit();
});

// Re-export types
export type { Worker, Job } from 'bullmq';
