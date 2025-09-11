import { processWebhookEvent } from '../../../src/workers/processWebhooks';
import { db as mockDb } from '../../../src/db/knex';
import { Job } from 'bullmq';

// db and logger are mocked in tests/setupTests.ts

describe('Webhook Processor', () => {
  const mockJob = (data: any): Job =>
    ({
      id: 'job-123',
      name: 'test-event',
      data: {
        event_id: data.id,
        event_type: data.type,
        payload: data.payload,
        status: 'pending',
        retry_count: 0,
      },
      attemptsMade: 0,
      timestamp: Date.now(),
      moveToCompleted: jest.fn(),
      moveToFailed: jest.fn(),
      update: jest.fn(),
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
      // Add other required Job properties with mock implementations
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for transaction
    (mockDb as any).transaction.mockImplementation((callback: any) => {
      const webhook_events = (mockDb as any).webhook_events || {
        where: jest.fn().mockReturnThis(),
        first: jest.fn(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 'we_123' }]),
      };
      const transactions = (mockDb as any).transactions || {
        insert: jest.fn().mockReturnThis(),
        onConflict: jest.fn().mockReturnThis(),
        merge: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 'txn_123' }]),
      };
      const subscriptions = (mockDb as any).subscriptions || {
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

      // Mirror to mockDb and preserve any pre-set overrides
      (mockDb as any).webhook_events = webhook_events;
      (mockDb as any).transactions = transactions;
      (mockDb as any).subscriptions = subscriptions;

      return callback(trx);
    });
  });

  it('should process a payment capture webhook', async () => {
    const eventData = {
      id: 'evt_123',
      type: 'net.authorize.payment.capture.created',
      payload: {
        id: 'py_123',
        amount: 1000,
        status: 'succeeded',
        payment: { id: 'pm_123' },
        order: { id: 'order_123' },
      },
      timestamp: new Date().toISOString(),
    };

    // Mock database responses
    (mockDb as any).webhook_events.first.mockResolvedValue(undefined);
    (mockDb as any).webhook_events.returning.mockResolvedValue([{ id: 'we_123' }]);
    (mockDb as any).transactions.returning.mockResolvedValue([{ id: 'txn_123' }]);
    (mockDb as any).webhook_events.update.mockResolvedValue([{ id: 'we_123' }]);

    const job = mockJob(eventData);
    await processWebhookEvent(job as any);

    expect((mockDb as any).webhook_events.where).toHaveBeenCalled();
    expect((mockDb as any).transactions.insert).toHaveBeenCalled();
  });

  it('should handle duplicate webhook events', async () => {
    const eventData = {
      id: 'evt_duplicate',
      type: 'net.authorize.payment.capture.created',
      payload: {},
      timestamp: new Date().toISOString(),
    };

    // Mock existing event already processed -> should be treated as duplicate
    (mockDb as any).webhook_events.first.mockResolvedValue({
      id: 'we_existing',
      status: 'processed',
    });

    const job = mockJob(eventData);
    const result = await processWebhookEvent(job as any);

    expect(result).toEqual({
      status: 'duplicate',
      eventId: 'evt_duplicate',
    });
    expect((mockDb as any).transactions.insert).not.toHaveBeenCalled();
  });

  it('should handle subscription update webhook', async () => {
    const eventData = {
      id: 'evt_sub_123',
      type: 'net.authorize.customer.subscription.updated',
      payload: {
        id: 'sub_123',
        status: 'active',
        customer: { id: 'cust_123' },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days later
      },
      timestamp: new Date().toISOString(),
    };

    // Mock database responses
    (mockDb as any).webhook_events.first.mockResolvedValue(undefined);
    (mockDb as any).webhook_events.returning.mockResolvedValue([{ id: 'we_123' }]);
    (mockDb as any).subscriptions.returning.mockResolvedValue([{ id: 'sub_123' }]);
    (mockDb as any).webhook_events.update.mockResolvedValue([{ id: 'we_123' }]);

    const job = mockJob(eventData);
    await processWebhookEvent(job as any);

    expect((mockDb as any).subscriptions.insert).toHaveBeenCalled();
  });

  it('should handle processing errors', async () => {
    const eventData = {
      id: 'evt_error',
      type: 'net.authorize.payment.capture.created',
      payload: {},
      timestamp: new Date().toISOString(),
    };

    // Simulate an error during processing on returning()
    (mockDb as any).webhook_events.first.mockResolvedValue(undefined);
    (mockDb as any).webhook_events.returning.mockResolvedValue([{ id: 'we_123' }]);
    (mockDb as any).transactions.returning.mockRejectedValue(new Error('DB error'));

    const job = mockJob(eventData);

    await expect(processWebhookEvent(job as any)).rejects.toThrow('DB error');
    expect((mockDb as any).webhook_events.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
      })
    );
  });
});
