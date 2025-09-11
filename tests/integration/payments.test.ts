import request from 'supertest';
import { app } from '../../src/app';
import { db } from '../../src/db/knex';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { authorizeNetService } from '../../src/services/authorizenetService';

// Mock the authorizeNetService
jest.mock('../../src/services/authorizenetService');

// Mock the database
jest.mock('../../src/db/knex', () => ({
  db: {
    raw: jest.fn(),
    fn: {
      now: jest.fn().mockReturnValue('NOW()'),
    },
    transactions: {
      insert: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      first: jest.fn().mockReturnThis(),
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
      first: jest.fn().mockResolvedValue(null),
    },
  },
}));

// Mock JWT verification
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ id: 'user-123', email: 'test@example.com' }),
}));

describe('Payments API', () => {
  const mockToken = 'mock-jwt-token';
  const idempotencyKey = uuidv4();

  const mockPaymentRequest = {
    amount: 100.5,
    currency: 'USD',
    paymentMethod: {
      cardNumber: '4111111111111111',
      expirationDate: '12/2025',
      cardCode: '123',
    },
    billingAddress: {
      firstName: 'John',
      lastName: 'Doe',
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      country: 'US',
      email: 'john.doe@example.com',
    },
    orderDescription: 'Test purchase',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful payment response
    (authorizeNetService.purchase as jest.Mock).mockResolvedValue({
      transactionId: 'auth-net-123',
      status: 'succeeded',
      responseCode: '1',
      message: 'Approved',
      rawResponse: {},
    });
  });

  describe('POST /payments/purchase', () => {
    it('should process a payment successfully', async () => {
      const response = await request(app)
        .post('/payments/purchase')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Idempotency-Key', idempotencyKey)
        .send(mockPaymentRequest);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('transactionId');
      expect(response.body.data).toHaveProperty('status', 'succeeded');
    });

    it('should return 400 for invalid payment data', async () => {
      const response = await request(app)
        .post('/payments/purchase')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Idempotency-Key', idempotencyKey)
        .send({
          // Missing required fields
          amount: 100,
          currency: 'USD',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 when idempotency key is missing', async () => {
      const response = await request(app)
        .post('/payments/purchase')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(mockPaymentRequest);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Idempotency-Key');
    });

    it('should handle payment processing errors', async () => {
      // Mock a failed payment
      (authorizeNetService.purchase as jest.Mock).mockRejectedValueOnce(
        new Error('Payment processing failed')
      );

      const response = await request(app)
        .post('/payments/purchase')
        .set('Authorization', `Bearer ${mockToken}`)
        .set('X-Idempotency-Key', idempotencyKey)
        .send(mockPaymentRequest);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Payment processing failed');
    });
  });

  describe('POST /payments/capture', () => {
    it('should capture a previously authorized payment', async () => {
      (authorizeNetService.capture as jest.Mock).mockResolvedValueOnce({
        transactionId: 'auth-net-123',
        status: 'succeeded',
        responseCode: '1',
        message: 'Approved',
        rawResponse: {},
      });

      const response = await request(app)
        .post('/payments/capture')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          transactionId: 'auth-123',
          amount: 100.5,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'succeeded');
    });
  });

  describe('POST /payments/void', () => {
    it('should void a transaction', async () => {
      (authorizeNetService.void as jest.Mock).mockResolvedValueOnce({
        transactionId: 'auth-net-123',
        status: 'succeeded',
        responseCode: '1',
        message: 'Voided',
        rawResponse: {},
      });

      const response = await request(app)
        .post('/payments/void')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          transactionId: 'auth-123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /payments/refund', () => {
    it('should process a refund', async () => {
      (authorizeNetService.refund as jest.Mock).mockResolvedValueOnce({
        transactionId: 'auth-net-123',
        status: 'succeeded',
        responseCode: '1',
        message: 'Refunded',
        rawResponse: {},
      });

      const response = await request(app)
        .post('/payments/refund')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          transactionId: 'auth-123',
          amount: 50.25,
          paymentMethod: mockPaymentRequest.paymentMethod,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('GET /payments/transactions/:id', () => {
    it('should return transaction details', async () => {
      const transactionId = 'test-transaction-id';

      // Mock the database response
      (db('transactions').first as jest.Mock).mockResolvedValueOnce({
        id: transactionId,
        user_id: 'user-123',
        amount: 100.5,
        currency: 'USD',
        status: 'succeeded',
        authorize_net_transaction_id: 'auth-net-123',
        correlation_id: 'corr-123',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const response = await request(app)
        .get(`/payments/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', transactionId);
    });

    it('should return 404 for non-existent transaction', async () => {
      const transactionId = 'non-existent-id';

      // Mock the database to return null
      (db('transactions').first as jest.Mock).mockResolvedValueOnce(null);

      const response = await request(app)
        .get(`/payments/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('not found');
    });
  });
});
