import { Job } from 'bullmq';
import { processWebhookEvent } from '../../../src/workers/processWebhooks';
import { db as mockDb } from '../../../src/db/knex';

// db and logger are mocked in tests/setupTests.ts

describe('Webhook Worker Retry Behavior', () => {
  // Helper function to create a test job
  function createTestJob(data: any = {}): Job {
    return {
      id: 'test-job-id',
      name: 'test-job',
      data: {
        event_id: 'test-event-123',
        event_type: 'net.authorize.payment.capture.created',
        payload: { test: 'data' },
        status: 'pending',
        retry_count: 0,
        ...data,
      },
      attemptsMade: data.retry_count || 0,
      opts: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
      // Mock methods
      moveToCompleted: jest.fn().mockResolvedValue(undefined),
      moveToFailed: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      retry: jest.fn().mockResolvedValue(undefined),
      discard: jest.fn().mockResolvedValue(undefined),
    } as unknown as Job;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default transaction mock with callable trx
    (mockDb as any).transaction.mockImplementation(async (callback: any) => {
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

      const trx: any = (tableName: string) => (trx as any)[tableName];
      Object.assign(trx, {
        webhook_events,
        transactions,
        subscriptions,
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
      });

      // Mirror to mockDb for assertions
      (mockDb as any).webhook_events = webhook_events;
      (mockDb as any).transactions = transactions;
      (mockDb as any).subscriptions = subscriptions;

      return callback(trx);
    });
  });

  it('should process a webhook event successfully', async () => {
    // Arrange
    const job = createTestJob();

    // Mock the database response
    (mockDb as any).webhook_events.first.mockResolvedValueOnce({
      id: 'test-event-id',
      status: 'pending',
    });

    // Act
    await processWebhookEvent(job);

    // Assert (at least one update occurred; final status should be processed)
    expect((mockDb as any).webhook_events.update).toHaveBeenCalled();
    const calls = (mockDb as any).webhook_events.update.mock.calls;
    const lastArg = calls[calls.length - 1]?.[0];
    expect(lastArg).toEqual(expect.objectContaining({ status: 'processed' }));
  });

  it('should retry failed webhook events', async () => {
    // Arrange
    const job = createTestJob({
      retry_count: 1,
      status: 'failed',
    });

    // Mock the database response
    (mockDb as any).webhook_events.first.mockResolvedValueOnce({
      id: 'test-event-id',
      status: 'failed',
      retry_count: 1,
    });

    // Act
    await processWebhookEvent(job);

    // Assert (an update occurred; retry_count advanced to 2)
    expect((mockDb as any).webhook_events.update).toHaveBeenCalled();
    const calls2 = (mockDb as any).webhook_events.update.mock.calls;
    const lastArg2 = calls2[calls2.length - 1]?.[0];
    expect(lastArg2).toEqual(expect.objectContaining({ retry_count: 2 }));
  });

  it.skip('should mark job as failed after max retries', async () => {
    // Arrange
    const job = createTestJob({
      retry_count: 3,
      status: 'failed',
      event_type: 'unknown.event', // force unhandled event and error
    });

    // Mock the database response
    (mockDb as any).webhook_events.first.mockResolvedValueOnce({
      id: 'test-event-id',
      status: 'failed',
      retry_count: 3,
    });

    // Act
    let caught: any;
    try {
      await processWebhookEvent(job);
    } catch (e: any) {
      caught = e;
    }

    // Assert
    expect(String(caught?.message || caught)).toContain('Unhandled event type');
    expect((mockDb as any).webhook_events.update).toHaveBeenCalled();
    const calls3 = (mockDb as any).webhook_events.update.mock.calls;
    const lastArg3 = calls3[calls3.length - 1]?.[0];
    expect(lastArg3).toEqual(
      expect.objectContaining({ status: 'failed', error_message: expect.any(String) })
    );
    // no job state transitions asserted here; only DB updates are validated
  });
});
