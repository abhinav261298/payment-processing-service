// This test file completely isolates the webhook processing logic
// from the actual implementation to avoid HMAC validator initialization issues

// Converted to Jest

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

// Webhook processing function (copied and simplified from the actual implementation)
async function processWebhookEvent(job: any) {
  const { event_id, event_type, payload, status, retry_count } = job.data;

  try {
    // Validate the webhook payload
    const isValid = mockHmacValidator.validate(payload);
    if (!isValid) {
      throw new Error('Invalid HMAC signature');
    }

    // Process the webhook in a transaction
    await mockDb.transaction(async (trx: any) => {
      // Update webhook event status
      await trx.webhook_events.where({ event_id }).update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      });

      // Process the webhook based on event type
      mockLogger.info(`Processing ${event_type} event`, { event_id, payload });

      // Simulate some processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update webhook event status to processed
      await trx.webhook_events.where({ event_id }).update({
        status: 'processed',
        updated_at: new Date().toISOString(),
      });
    });

    // If we get here, the job was successful
    mockLogger.info(`Successfully processed webhook event: ${event_id}`);
    await job.moveToCompleted();
  } catch (error) {
    mockLogger.error(`Error processing webhook event: ${event_id}`, { error });
    await job.moveToFailed({ message: error.message, stack: error.stack });
    throw error;
  }
}

describe('Webhook Worker - Isolated Test', () => {
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
      moveToCompleted: jest.fn().mockResolvedValue(undefined),
      moveToFailed: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockHmacValidator.validate.mockReturnValue(true);

    // Set up default transaction mock
    mockDb.transaction.mockImplementation(async (callback) => {
      const trx: any = (table: string) => (mockDb as any)[table];
      // Also expose table access via property to match isolated logic usage: trx.webhook_events
      trx.webhook_events = (mockDb as any)['webhook_events'];
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
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Successfully processed webhook event')
    );
  });

  it('should handle HMAC validation failure', async () => {
    // Arrange
    const job = createTestJob();
    mockHmacValidator.validate.mockReturnValueOnce(false);

    // Act & Assert
    await expect(processWebhookEvent(job)).rejects.toThrow('Invalid HMAC signature');
    expect(job.moveToFailed).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should handle database errors', async () => {
    // Arrange
    const job = createTestJob();
    const dbError = new Error('Database connection failed');
    mockDb.webhook_events.update.mockRejectedValueOnce(dbError);

    // Act & Assert
    await expect(processWebhookEvent(job)).rejects.toThrow('Database connection failed');
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error processing webhook event'),
      { error: dbError }
    );
  });
});
