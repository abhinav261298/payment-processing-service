import { Job } from 'bullmq';

// Set test environment variables before any imports
process.env.AUTHNET_SIGNATURE_KEY = 'test-secret-key';

// The db and logger modules are mocked in tests/setupTests.ts
// Now import the function we want to test
import { processWebhookEvent } from '../../../src/workers/processWebhooks';
import { db as mockDb } from '../../../src/db/knex';

describe('Webhook Worker', () => {
  // Helper to create a test job with proper typing
  function createTestJob(data: Partial<Job> = {}): Job {
    return {
      id: 'test-job-id',
      name: 'test-job',
      data: {
        event_id: 'test-event-123',
        event_type: 'net.authorize.payment.capture.created',
        payload: { test: 'data' },
        status: 'pending',
        retry_count: 0,
        ...data.data,
      },
      queue: {
        name: 'test-queue',
        qualifiedName: 'test-queue',
        // Add other required queue methods
      } as any,
      queueQualifiedName: 'test-queue',
      progress: 0,
      returnvalue: null,
      attemptsMade: data.attemptsMade || 0,
      processedOn: Date.now(),
      timestamp: Date.now(),
      opts: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        ...data.opts,
      },
      // Mock methods
      moveToCompleted: jest.fn().mockResolvedValue(undefined),
      moveToFailed: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      retry: jest.fn().mockResolvedValue(undefined),
      discard: jest.fn().mockResolvedValue(undefined),
      promote: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      log: jest.fn().mockResolvedValue(undefined),
      isFailed: jest.fn().mockReturnValue(false),
      isCompleted: jest.fn().mockReturnValue(false),
      isActive: jest.fn().mockReturnValue(true),
      isWaiting: jest.fn().mockReturnValue(false),
      isDelayed: jest.fn().mockReturnValue(false),
      isStuck: jest.fn().mockReturnValue(false),
      isWaitingChildren: jest.fn().mockReturnValue(false),
      toKey: jest.fn().mockReturnValue('bull:test-queue:test-job-id'),
      waitUntilFinished: jest.fn().mockResolvedValue(undefined),
      // Add other required Job properties with mock implementations
      ...data,
    } as unknown as Job;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default transaction mock
    (mockDb as any).transaction.mockImplementation(async (callback: any) => {
      // Define table APIs
      const webhook_events = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 'we_123' }]),
      };
      const transactions = {
        insert: jest.fn().mockReturnThis(),
        onConflict: jest.fn().mockReturnThis(),
        merge: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 'txn_123' }]),
      };
      const subscriptions = {
        insert: jest.fn().mockReturnThis(),
        onConflict: jest.fn().mockReturnThis(),
        merge: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 'sub_123' }]),
      };

      // Create callable trx(tableName)
      const trx: any = (tableName: string) => (trx as any)[tableName];
      Object.assign(trx, {
        webhook_events,
        transactions,
        subscriptions,
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
      });

      // Also mirror on mockDb for test expectations
      (mockDb as any).webhook_events = webhook_events;
      (mockDb as any).transactions = transactions;
      (mockDb as any).subscriptions = subscriptions;

      return callback(trx);
    });
  });

  it('should process a webhook event successfully', async () => {
    // Arrange
    const job = createTestJob();

    // Act
    const result = await processWebhookEvent(job);

    // Assert
    expect((mockDb as any).webhook_events.update).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ status: 'processed', eventId: expect.any(String) })
    );
  });
});
