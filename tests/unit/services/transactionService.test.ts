import { transactionService } from '../../../src/services/transactionService';
import { TransactionStatus } from '../../../src/types/database';
import { db } from '../../../src/db/knex';

// Mock the database: callable db(table) with per-table APIs
jest.mock('../../../src/db/knex', () => {
  const tables: any = {
    transactions: {
      insert: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
      returning: jest.fn().mockResolvedValue([
        {
          id: 'test-transaction-id',
          user_id: 'user-123',
          amount: 100.5,
          currency: 'USD',
          status: 'pending',
          authorize_net_transaction_id: null,
          correlation_id: 'corr-123',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]),
    },
    payment_logs: {
      insert: jest.fn().mockResolvedValue([1]),
    },
    idempotency_keys: {
      insert: jest.fn().mockResolvedValue([1]),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    },
  };

  const db: any = (tableName: string) => tables[tableName];
  db.raw = jest.fn();
  db.fn = { now: jest.fn().mockReturnValue('NOW()') };
  return { db };
});

describe('TransactionService', () => {
  const mockTransaction = {
    userId: 'user-123',
    amount: 100.5,
    currency: 'USD',
    status: TransactionStatus.PENDING as const,
    authorizeNetTransactionId: null,
    correlationId: 'corr-123',
    metadata: { test: 'data' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTransaction', () => {
    it('should create a new transaction', async () => {
      const result = await transactionService.createTransaction(mockTransaction);

      expect(db('transactions').insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockTransaction.userId,
          amount: mockTransaction.amount,
          currency: mockTransaction.currency,
          status: mockTransaction.status,
          correlation_id: mockTransaction.correlationId,
          metadata: mockTransaction.metadata,
        })
      );

      expect(result).toHaveProperty('id');
    });
  });

  describe('getTransactionById', () => {
    it('should retrieve a transaction by ID', async () => {
      const transactionId = 'test-transaction-id';
      await transactionService.getTransactionById(transactionId);

      expect(db('transactions').where).toHaveBeenCalledWith({ id: transactionId });
      expect(db('transactions').first).toHaveBeenCalled();
    });
  });

  describe('getTransactionByAuthorizeNetId', () => {
    it('should retrieve a transaction by Authorize.net ID', async () => {
      const authNetId = 'auth-net-123';
      await transactionService.getTransactionByAuthorizeNetId(authNetId);

      expect(db('transactions').where).toHaveBeenCalledWith({
        authorize_net_transaction_id: authNetId,
      });
      expect(db('transactions').first).toHaveBeenCalled();
    });
  });

  describe('updateTransaction', () => {
    it('should update a transaction', async () => {
      const transactionId = 'test-transaction-id';
      const updates = {
        status: TransactionStatus.COMPLETED as const,
        authorizeNetTransactionId: 'auth-net-123',
        metadata: { newData: 'value' },
      };

      await transactionService.updateTransaction(transactionId, updates);

      expect(db('transactions').where).toHaveBeenCalledWith({ id: transactionId });
      expect(db('transactions').update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: updates.status,
          authorize_net_transaction_id: updates.authorizeNetTransactionId,
          updated_at: expect.anything(),
          metadata: expect.anything(),
        })
      );
    });
  });

  describe('logPayment', () => {
    it('should log a payment', async () => {
      const transactionId = 'test-transaction-id';
      const gatewayResponse = { status: 'success' };
      const action = 'purchase';

      await transactionService.logPayment(transactionId, gatewayResponse, action);

      expect(db('payment_logs').insert).toHaveBeenCalledWith({
        id: expect.any(String),
        transaction_id: transactionId,
        action,
        gateway_response: gatewayResponse,
        created_at: expect.any(Date),
      });
    });
  });

  describe('checkIdempotency', () => {
    it('should return null when no idempotency key exists', async () => {
      const idempotencyKey = 'test-key';
      const requestPath = '/payments/purchase';

      const result = await transactionService.checkIdempotency(idempotencyKey, requestPath);

      expect(db('idempotency_keys').where).toHaveBeenCalledWith({
        key: idempotencyKey,
        request_path: requestPath,
      });
      expect(db('idempotency_keys').andWhere).toHaveBeenCalledWith(
        'expires_at',
        '>',
        expect.any(Date)
      );
      expect(result).toBeNull();
    });

    it('should return the cached response when idempotency key exists', async () => {
      const idempotencyKey = 'test-key';
      const requestPath = '/payments/purchase';
      const mockResponse = { data: 'cached' };

      // Mock the database to return a cached response
      (db('idempotency_keys').first as jest.Mock).mockResolvedValueOnce({
        response: mockResponse,
        status_code: 200,
      });

      const result = await transactionService.checkIdempotency(idempotencyKey, requestPath);

      expect(result).toEqual({
        response: mockResponse,
        statusCode: 200,
      });
    });
  });

  describe('createIdempotencyKey', () => {
    it('should create a new idempotency key', async () => {
      const key = 'test-key';
      const requestPath = '/payments/purchase';
      const requestParams = { amount: 100 };
      const response = { success: true };
      const statusCode = 200;

      await transactionService.createIdempotencyKey(
        key,
        requestPath,
        requestParams,
        response,
        statusCode
      );

      expect(db('idempotency_keys').insert).toHaveBeenCalledWith({
        id: expect.any(String),
        key,
        request_path: requestPath,
        request_params: requestParams,
        response,
        status_code: statusCode,
        expires_at: expect.any(Date),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });
  });
});
