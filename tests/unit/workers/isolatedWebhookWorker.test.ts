// Converted to Jest
import { Job } from 'bullmq';

// Mock the database
const mockDb = {
  transaction: jest.fn(),
  webhook_events: {
    where: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ id: 'test-event-id' }]),
  },
};

// Mock the database module
jest.mock('../../../src/db/knex', () => ({
  db: mockDb,
}));

// Mock the logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: () => mockLogger,
};

jest.mock('../../../src/utils/logger', () => ({
  logger: mockLogger,
}));

// Mock the HMAC validator
jest.mock('../../../src/utils/hmacValidator', () => ({
  HmacValidator: class {
    secretKey = 'test-secret-key';
    validate() {
      return true;
    }
    static getMiddleware() {
      return jest.fn();
    }
  },
  hmacValidator: {
    validate: () => true,
  },
}));

// Now import the function we want to test
import { processWebhookEvent } from '../../../src/workers/processWebhooks';

describe('Webhook Worker - Isolated', () => {
  // Helper to create a test job with proper typing
  function createTestJob(data: any = {}) {
    return {
      id: 'test-job-id',
      name: 'test-job',
      data: {
        event_id: 'test-event-123',
        event_type: 'test.event',
        payload: { test: 'data' },
        status: 'pending',
        retry_count: 0,
        ...data.data,
      },
      queue: {
        name: 'test-queue',
        qualifiedName: 'test-queue',
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
      ...data,
    } as unknown as Job;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default transaction mock
    mockDb.transaction.mockImplementation(async (callback) => {
      const trx: any = (table: string) => (mockDb as any)[table];
      trx.commit = jest.fn().mockResolvedValue(undefined);
      trx.rollback = jest.fn().mockResolvedValue(undefined);
      return callback(trx);
    });
  });

  it('should process a webhook event successfully', async () => {
    // Arrange
    const job = createTestJob();

    // Act
    await processWebhookEvent(job);

    // Assert
    expect(mockDb.webhook_events.update).toHaveBeenCalled();
    expect(job.moveToCompleted).toHaveBeenCalled();
  });

  it('should retry failed webhook events', async () => {
    // Arrange
    const job = createTestJob({
      attemptsMade: 1,
      data: {
        event_id: 'test-event-456',
        event_type: 'test.failure',
        payload: { test: 'failure' },
        status: 'failed',
        retry_count: 1,
      },
    });

    // Mock a database error
    mockDb.webhook_events.update.mockRejectedValueOnce(new Error('Database error'));

    // Act & Assert
    await expect(processWebhookEvent(job)).rejects.toThrow('Database error');
    expect(job.moveToFailed).toHaveBeenCalled();
  });
});
