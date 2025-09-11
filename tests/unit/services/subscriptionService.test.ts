import { SubscriptionService } from '../../../src/services/subscriptionService';
import { db } from '../../../src/db/knex';
import { AuthorizeNetService } from '../../../src/services/authorizenetService';
import { SubscriptionStatus, SubscriptionInterval } from '../../../src/types/database';

// Mock the database and AuthorizeNetService
jest.mock('../../../src/db/knex');
jest.mock('../../../src/services/authorizenetService');

describe.skip('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;
  let mockAuthorizeNetService: jest.Mocked<AuthorizeNetService>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create a new instance of the service with mocked dependencies
    mockAuthorizeNetService = new AuthorizeNetService() as jest.Mocked<AuthorizeNetService>;
    subscriptionService = new SubscriptionService(mockAuthorizeNetService);
  });

  describe('createSubscription', () => {
    it('should create a new subscription successfully', async () => {
      // Mock database response
      const mockSubscription = {
        id: 'sub_123',
        user_id: 'user_123',
        plan_name: 'Premium',
        amount: 29.99,
        currency: 'USD',
        interval: SubscriptionInterval.MONTH,
        status: SubscriptionStatus.ACTIVE,
        authorize_net_subscription_id: 'authnet_123',
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock database and authorize.net service
      db('subscriptions').insert.mockResolvedValueOnce([mockSubscription]);
      mockAuthorizeNetService.createSubscription.mockResolvedValueOnce({
        subscriptionId: 'authnet_123',
        status: 'active',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // Call the method
      const result = await subscriptionService.createSubscription({
        userId: 'user_123',
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
      });

      // Assertions
      expect(db('subscriptions').insert).toHaveBeenCalled();
      expect(mockAuthorizeNetService.createSubscription).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          id: 'sub_123',
          status: SubscriptionStatus.ACTIVE,
        })
      );
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel an active subscription', async () => {
      const subscriptionId = 'sub_123';
      const mockSubscription = {
        id: subscriptionId,
        user_id: 'user_123',
        status: SubscriptionStatus.ACTIVE,
        authorize_net_subscription_id: 'authnet_123',
      };

      // Mock database responses
      db('subscriptions').where.mockReturnValueOnce({
        first: jest.fn().mockResolvedValueOnce(mockSubscription),
      });

      db('subscriptions').where.mockReturnValueOnce({
        update: jest.fn().mockResolvedValueOnce([
          {
            ...mockSubscription,
            status: SubscriptionStatus.CANCELED,
          },
        ]),
      });

      // Mock authorize.net service
      mockAuthorizeNetService.cancelSubscription.mockResolvedValueOnce(true);

      // Call the method
      const result = await subscriptionService.cancelSubscription(subscriptionId);

      // Assertions
      expect(mockAuthorizeNetService.cancelSubscription).toHaveBeenCalledWith('authnet_123');
      expect(result).toBe(true);
    });
  });

  describe('getSubscription', () => {
    it('should return a subscription by id', async () => {
      const subscriptionId = 'sub_123';
      const mockSubscription = {
        id: subscriptionId,
        user_id: 'user_123',
        status: SubscriptionStatus.ACTIVE,
        plan_name: 'Premium',
      };

      // Mock database response
      db('subscriptions').where.mockReturnValueOnce({
        first: jest.fn().mockResolvedValueOnce(mockSubscription),
      });

      // Call the method
      const result = await subscriptionService.getSubscription(subscriptionId);

      // Assertions
      expect(db('subscriptions').where).toHaveBeenCalledWith('id', subscriptionId);
      expect(result).toEqual(mockSubscription);
    });
  });
});
