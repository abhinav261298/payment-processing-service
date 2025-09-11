// Jest-based test setup for global mocks

// Mock the logger using our manual mock
jest.mock('../src/utils/logger');

// Mock the HMAC validator using our manual mock (tests/__mocks__/hmacValidator.ts)
jest.mock('../src/utils/hmacValidator');

// Mock the database connection
jest.mock('../src/db/knex', () => {
  const createTables = () => ({
    webhook_events: {
      where: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn(),
    },
    transactions: {
      insert: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      merge: jest.fn().mockReturnThis(),
      returning: jest.fn(),
    },
    subscriptions: {
      insert: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      merge: jest.fn().mockReturnThis(),
      returning: jest.fn(),
    },
  });

  const tables = createTables();

  const db: any = {
    ...tables,
    transaction: jest.fn().mockImplementation(async (callback: any) => {
      const localTables = createTables();
      const trx: any = (tableName: string) => (trx as any)[tableName];
      Object.assign(trx, {
        ...localTables,
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
      });
      // Also expose the same references on db for assertions if needed
      Object.assign(db, localTables);
      return callback(trx);
    }),
  };

  return { db };
});

// Mock the webhook queue config
jest.mock('../src/queues/config', () => ({
  QueueName: { WEBHOOK_EVENTS: 'webhook_events' },
  queueConfig: {},
  webhookQueue: {
    add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
    getJob: jest.fn().mockResolvedValue(null),
    getJobs: jest.fn().mockResolvedValue([]),
  },
}));
