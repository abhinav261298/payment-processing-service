import request from 'supertest';
import { Server } from 'http';
import { app } from '../../src/app';
import { db } from '../../src/db/knex';
import { SubscriptionStatus, SubscriptionInterval } from '../../src/types/database';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  createTestUser,
  createTestSubscription,
  getTestServerUrl,
} from '../testHelpers';

// Mock AuthorizeNetService
jest.mock('../../src/services/authorizenetService');

describe('Subscription API', () => {
  let testServer: Server;
  let authToken: string;
  let testUser: any;
  let testSubscription: any;

  beforeAll(async () => {
    await setupTestEnvironment();
    testServer = (global as any).testServer;

    // Create a test user
    testUser = await createTestUser({
      email: 'subscription-test@example.com',
      first_name: 'Subscription',
      last_name: 'Test',
      role: 'user',
    });

    // Create a test subscription
    testSubscription = await createTestSubscription({
      user_id: testUser.id,
      plan_name: 'Premium',
      amount: 29.99,
      currency: 'USD',
      interval: SubscriptionInterval.MONTH,
      status: SubscriptionStatus.ACTIVE,
    });

    // Login to get auth token (simplified for testing)
    authToken = 'test-auth-token';
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  describe('POST /api/subscriptions', () => {
    it('should create a new subscription', async () => {
      const newSubscription = {
        planName: 'Premium',
        amount: 29.99,
        currency: 'USD',
        interval: SubscriptionInterval.MONTH,
        paymentMethod: {
          type: 'credit_card',
          cardNumber: '4111111111111111',
          expirationDate: '12/25',
          cardCode: '123',
        },
      };

      const response = await request(getTestServerUrl())
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newSubscription);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        plan_name: 'Premium',
        amount: '29.99',
        currency: 'USD',
        status: 'active',
      });
    });
  });

  describe('POST /api/subscriptions/:id/cancel', () => {
    it('should cancel an active subscription', async () => {
      const response = await request(getTestServerUrl())
        .post(`/api/subscriptions/${testSubscription.id}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Subscription cancelled successfully',
      });
    });

    it('should return 404 for non-existent subscription', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await request(getTestServerUrl())
        .post(`/api/subscriptions/${nonExistentId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/subscriptions/:id', () => {
    it('should return a subscription by id', async () => {
      const response = await request(getTestServerUrl())
        .get(`/api/subscriptions/${testSubscription.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: testSubscription.id,
        plan_name: 'Premium',
        status: 'active',
      });
    });
  });
});
