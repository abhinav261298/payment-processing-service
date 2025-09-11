import { AuthorizeNetService, PaymentRequest } from '../../../src/services/authorizenetService';
import { TransactionStatus } from '../../../src/types/database';

// Mock the authorizenet client
jest.mock('authorizenet', () => {
  const APIContracts = {
    CreditCardType: jest.fn().mockImplementation(() => ({
      setCardNumber: jest.fn(),
      setExpirationDate: jest.fn(),
      setCardCode: jest.fn(),
    })),
    PaymentType: jest.fn().mockImplementation(() => ({
      setCreditCard: jest.fn(),
    })),
    CustomerAddressType: jest.fn().mockImplementation(() => ({
      setFirstName: jest.fn(),
      setLastName: jest.fn(),
      setAddress: jest.fn(),
      setCity: jest.fn(),
      setState: jest.fn(),
      setZip: jest.fn(),
      setCountry: jest.fn(),
    })),
    CustomerDataType: jest.fn().mockImplementation(() => ({
      setEmail: jest.fn(),
    })),
    MerchantAuthenticationType: jest.fn().mockImplementation(() => ({
      setName: jest.fn(),
      setTransactionKey: jest.fn(),
    })),
    TransactionRequestType: jest.fn().mockImplementation(() => ({
      setTransactionType: jest.fn(),
      setAmount: jest.fn(),
      setPayment: jest.fn(),
      setBillTo: jest.fn(),
      setDescription: jest.fn(),
      setCustomer: jest.fn(),
      setRefTransId: jest.fn(),
    })),
    CreateTransactionRequest: jest.fn().mockImplementation(() => ({
      setMerchantAuthentication: jest.fn(),
      setTransactionRequest: jest.fn(),
    })),
  };

  const mockResponse = {
    getTransactionResponse: () => ({
      transId: '1234567890',
      responseCode: '1',
      messages: [{ code: '1', description: 'This transaction has been approved.' }],
    }),
  };

  const APIControllers = {
    CreateTransactionController: jest.fn().mockImplementation(() => ({
      execute: (cb: Function) => cb(),
      getResponse: () => mockResponse,
    })),
  };

  return { APIContracts, APIControllers };
});

describe('AuthorizeNetService', () => {
  let service: AuthorizeNetService;

  const mockPaymentRequest: PaymentRequest = {
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
    },
    orderDescription: 'Test purchase',
  };

  beforeEach(() => {
    process.env.AUTHORIZE_NET_API_LOGIN_ID = 'test_login_id';
    process.env.AUTHORIZE_NET_TRANSACTION_KEY = 'test_transaction_key';
    service = new AuthorizeNetService();
    jest.clearAllMocks();
  });

  describe('purchase', () => {
    it('should process a purchase transaction', async () => {
      const result = await service.purchase(mockPaymentRequest);

      expect(result.transactionId).toBe('1234567890');
      expect(result.status).toBe(TransactionStatus.COMPLETED);
      expect(result.responseCode).toBe('1');
    });

    it('should throw an error if credentials are missing', async () => {
      delete process.env.AUTHORIZE_NET_API_LOGIN_ID;

      await expect(service.purchase(mockPaymentRequest)).rejects.toThrow(
        'Authorize.net credentials not configured'
      );
    });
  });

  describe('authorize', () => {
    it('should authorize a transaction', async () => {
      const result = await service.authorize(mockPaymentRequest);

      expect(result.transactionId).toBe('1234567890');
      expect(result.status).toBe(TransactionStatus.COMPLETED);
    });
  });

  describe('capture', () => {
    it('should capture a previously authorized transaction', async () => {
      const transactionId = 'AUTH123';
      const amount = 100.5;

      const result = await service.capture(transactionId, amount);

      expect(result.transactionId).toBe('1234567890');
      expect(result.status).toBe(TransactionStatus.COMPLETED);
    });
  });

  describe('void', () => {
    it('should void a transaction', async () => {
      const transactionId = 'AUTH123';

      const result = await service.void(transactionId);

      expect(result.transactionId).toBe('1234567890');
      expect(result.status).toBe(TransactionStatus.COMPLETED);
    });
  });

  describe('refund', () => {
    it('should process a refund', async () => {
      const transactionId = 'AUTH123';
      const amount = 50.25;

      const result = await service.refund(transactionId, amount, mockPaymentRequest);

      expect(result.transactionId).toBe('1234567890');
      expect(result.status).toBe(TransactionStatus.COMPLETED);
    });
  });

  describe('mapStatus', () => {
    it('should map Authorize.net status codes to our status values', () => {
      // @ts-ignore - accessing private method for testing
      expect(service.mapStatus('1')).toBe(TransactionStatus.COMPLETED); // Approved
      // @ts-ignore
      expect(service.mapStatus('2')).toBe(TransactionStatus.DECLINED); // Declined
      // @ts-ignore
      expect(service.mapStatus('3')).toBe(TransactionStatus.FAILED); // Error
      // @ts-ignore
      expect(service.mapStatus('4')).toBe(TransactionStatus.PENDING); // Held for Review
      // @ts-ignore
      expect(service.mapStatus('5')).toBe(TransactionStatus.FAILED); // Default case
    });
  });
});
