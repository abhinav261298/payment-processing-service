import { Server } from 'http';
import { app } from '../src/app';
import { db } from '../src/db/knex';
import { SubscriptionInterval, SubscriptionStatus } from '../src/types/database';

declare global {
  namespace NodeJS {
    interface Global {
      testServer: Server;
    }
  }
}

// Mock the database and services
export const setupTestEnvironment = async (): Promise<Server> => {
  // Start the server
  const server = new Server();

  // Store the server instance globally
  global.testServer = server;

  try {
    // Initialize the database
    await db.migrate.latest();
    await db.seed.run();

    // Start the Express app on the server
    const expressApp = await app;
    expressApp.listen(0); // Use port 0 to get a random available port

    return server;
  } catch (error) {
    console.error('Failed to set up test environment:', error);
    throw error;
  }
};

export const teardownTestEnvironment = async (): Promise<void> => {
  try {
    // Close the server if it exists
    if (global.testServer) {
      await new Promise<void>((resolve, reject) => {
        global.testServer.close((err) => (err ? reject(err) : resolve()));
      });
    }

    // Close the database connection
    if (db) {
      await db.destroy();
    }
  } catch (error) {
    console.error('Error during test teardown:', error);
    throw error;
  }
};

// Helper function to get the test server URL
export const getTestServerUrl = (): string => {
  const server = global.testServer;
  if (!server) {
    throw new Error('Test server not started');
  }

  const address = server.address();
  if (!address) {
    throw new Error('Could not get test server address');
  }

  if (typeof address === 'string') {
    return address;
  }

  return `http://localhost:${address.port}`;
};

// Helper function to create a test user
export const createTestUser = async (userData: Partial<any> = {}) => {
  const [user] = await db('users')
    .insert({
      first_name: 'Test',
      last_name: 'User',
      email: `test-${Date.now()}@example.com`,
      password_hash: 'hashed_password',
      role: 'user',
      ...userData,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');
  return user;
};

// Helper function to create a test subscription
export const createTestSubscription = async (subscriptionData: Partial<any> = {}) => {
  const [subscription] = await db('subscriptions')
    .insert({
      plan_name: 'Test Plan',
      amount: 9.99,
      currency: 'USD',
      interval: SubscriptionInterval.MONTH,
      status: SubscriptionStatus.ACTIVE,
      authorize_net_subscription_id: `authnet_${Date.now()}`,
      ...subscriptionData,
      created_at: new Date(),
      updated_at: new Date(),
    } as any) // Cast to any to bypass type checking for test data
    .returning('*');
  return subscription;
};
