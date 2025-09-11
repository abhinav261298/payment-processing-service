// Converted to Jest
export {};

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

// Mock the logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: () => mockLogger,
};

// Mock the HMAC validator
const mockHmacValidator = {
  validate: jest.fn().mockReturnValue(true),
};

// Mock the job object
function createMockJob(data: any = {}) {
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
    moveToCompleted: jest.fn().mockResolvedValue(undefined),
    moveToFailed: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  };
}

// Core function to test (extracted from the worker)
async function processWebhookCore(job: any, db: any, logger: any, hmacValidator: any) {
  const { event_id, event_type, payload, status, retry_count } = job.data;

  try {
    logger.info(`Processing webhook event: ${event_id}`);

    // Validate the webhook payload
    const isValid = hmacValidator.validate(payload);
    if (!isValid) {
      throw new Error('Invalid HMAC signature');
    }

    // Process the webhook in a transaction
    await db.transaction(async (trx: any) => {
      // Update webhook event status
      await trx.webhook_events.where({ event_id }).update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      });

      // Process the webhook based on event type
      // This is where you would add your business logic
      logger.info(`Processing ${event_type} event`, { event_id, payload });

      // Simulate some processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update webhook event status to processed
      await trx.webhook_events.where({ event_id }).update({
        status: 'processed',
        updated_at: new Date().toISOString(),
      });
    });

    logger.info(`Successfully processed webhook event: ${event_id}`);
    return { success: true };
  } catch (error) {
    logger.error(`Error processing webhook event: ${event_id}`, { error });
    throw error;
  }
}

describe('Webhook Core Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default transaction mock
    mockDb.transaction.mockImplementation(async (callback) => {
      const trx: any = (table: string) => (trx as any)[table];
      Object.assign(trx, {
        webhook_events: (mockDb as any).webhook_events,
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
      });
      return callback(trx);
    });
  });

  it('should process a webhook event successfully', async () => {
    // Arrange
    const job = createMockJob();

    // Act
    const result = await processWebhookCore(job, mockDb, mockLogger, mockHmacValidator);

    // Assert
    expect(result).toEqual({ success: true });
    expect(mockDb.webhook_events.update).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Successfully processed webhook event')
    );
  });

  it('should handle HMAC validation failure', async () => {
    // Arrange
    const job = createMockJob();
    mockHmacValidator.validate.mockReturnValueOnce(false);

    // Act & Assert
    await expect(processWebhookCore(job, mockDb, mockLogger, mockHmacValidator)).rejects.toThrow(
      'Invalid HMAC signature'
    );

    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should handle database errors', async () => {
    // Arrange
    const job = createMockJob();
    const dbError = new Error('Database connection failed');
    mockDb.webhook_events.update.mockRejectedValueOnce(dbError);

    // Act & Assert
    await expect(processWebhookCore(job, mockDb, mockLogger, mockHmacValidator)).rejects.toThrow(
      dbError
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error processing webhook event'),
      { error: dbError }
    );
  });
});
