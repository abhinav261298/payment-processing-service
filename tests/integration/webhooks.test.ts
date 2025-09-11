import request from 'supertest';
import { app } from '../../src/app';
import { db } from '../../src/db/knex';
import { webhookQueue } from '../../src/queues/config';
import { hmacValidator } from '../../src/utils/hmacValidator';
import { createTestUser, setupTestEnvironment, teardownTestEnvironment } from '../testHelpers';

// Mock the queue and HMAC validator
jest.mock('../../src/queues/config');
jest.mock('../../src/utils/hmacValidator');

describe('Webhook API', () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    await setupTestEnvironment();

    // Create a test user
    testUser = await createTestUser({
      email: 'webhook-test@example.com',
      first_name: 'Webhook',
      last_name: 'Test',
      role: 'admin',
    });

    // Mock HMAC validation to always pass in tests
    (hmacValidator.isValidSignature as jest.Mock).mockReturnValue(true);
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /webhooks/authorizenet', () => {
    const validPayload = {
      id: 'evt_123',
      type: 'payment.captured',
      data: {
        object: {
          id: 'py_123',
          amount: 1000,
          status: 'succeeded',
        },
      },
    };

    it('should accept a valid webhook with correct signature', async () => {
      // Mock the queue add method
      (webhookQueue.add as jest.Mock).mockResolvedValue({ id: 'job-123' });

      const response = await request(app)
        .post('/webhooks/authorizenet')
        .set('Content-Type', 'application/json')
        .set('X-Anet-Signature', 'valid-signature')
        .set('X-Anet-Event-Type', 'net.authorize.payment.capture.created')
        .send(validPayload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(webhookQueue.add).toHaveBeenCalledWith(
        expect.stringContaining('webhook:net.authorize.payment.capture.created'),
        expect.objectContaining({
          id: 'valid-signature',
          type: 'net.authorize.payment.capture.created',
          payload: validPayload,
        }),
        expect.any(Object)
      );
    });

    it('should reject requests without signature header', async () => {
      const response = await request(app)
        .post('/webhooks/authorizenet')
        .set('Content-Type', 'application/json')
        .set('X-Anet-Event-Type', 'net.authorize.payment.capture.created')
        .send(validPayload);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(webhookQueue.add).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid signature', async () => {
      // Mock HMAC validation to fail
      (hmacValidator.isValidSignature as jest.Mock).mockReturnValueOnce(false);

      const response = await request(app)
        .post('/webhooks/authorizenet')
        .set('Content-Type', 'application/json')
        .set('X-Anet-Signature', 'invalid-signature')
        .set('X-Anet-Event-Type', 'net.authorize.payment.capture.created')
        .send(validPayload);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid signature');
      expect(webhookQueue.add).not.toHaveBeenCalled();
    });
  });
});
