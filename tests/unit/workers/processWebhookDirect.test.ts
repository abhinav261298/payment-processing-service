// Set up mocks before any imports
const mockHmacValidator = {
  validate: jest.fn().mockReturnValue(true),
};

// Mock the module directly
jest.mock('../../../src/utils/hmacValidator', () => ({
  HmacValidator: jest.fn().mockImplementation(() => ({
    validate: mockHmacValidator.validate,
  })),
  hmacValidator: mockHmacValidator,
}));

// Mock the database (define before jest.mock)
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

// Now import the function we want to test (after mocks)
import { processWebhookEvent } from '../../../src/workers/processWebhooks';

describe('Webhook Worker - Direct Test', () => {
  // Helper to create a test job
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
        ...data,
      },
      attemptsMade: 0,
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
      moveToCompleted: jest.fn().mockResolvedValue(undefined),
      moveToFailed: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
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
    await processWebhookEvent(job as any);

    // Assert
    expect(mockDb.webhook_events.update).toHaveBeenCalled();
    expect(job.moveToCompleted).toHaveBeenCalled();
  });

  it('should handle HMAC validation failure', async () => {
    // Arrange
    const job = createTestJob();
    mockHmacValidator.validate.mockReturnValueOnce(false);

    // Act & Assert
    await expect(processWebhookEvent(job as any)).rejects.toThrow('Invalid HMAC signature');
    expect(job.moveToFailed).toHaveBeenCalled();
  });

  it('should handle database errors', async () => {
    // Arrange
    const job = createTestJob();
    const dbError = new Error('Database connection failed');
    mockDb.webhook_events.update.mockRejectedValueOnce(dbError);

    // Act & Assert
    await expect(processWebhookEvent(job as any)).rejects.toThrow(dbError);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
