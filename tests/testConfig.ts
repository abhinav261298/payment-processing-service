import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.test file
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Default test configuration
export const TEST_CONFIG = {
  // Database
  DB_CLIENT: process.env.DB_CLIENT || 'pg',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
  DB_NAME: process.env.DB_NAME || 'payment_processing_test',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',

  // Test user
  TEST_USER: {
    email: 'test@example.com',
    password: 'testpassword123',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
  },

  // Test subscription
  TEST_SUBSCRIPTION: {
    planName: 'Premium',
    amount: 29.99,
    currency: 'USD',
    interval: 'month' as const,
    paymentMethod: {
      type: 'credit_card' as const,
      cardNumber: '4111111111111111',
      expirationDate: '12/25',
      cardCode: '123',
    },
  },
};

// Export types for test data
export type TestUser = typeof TEST_CONFIG.TEST_USER;
export type TestSubscription = typeof TEST_CONFIG.TEST_SUBSCRIPTION;
