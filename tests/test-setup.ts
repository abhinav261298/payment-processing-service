import { knex, Knex } from 'knex';
import config from '../knexfile';
import { Server } from 'http';
import express from 'express';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random port for tests
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgres://postgres@localhost:5432/payment_processing_test';

// Create a test database connection
const testDb = knex(config.test);

// Global variables
declare global {
  var db: Knex;
  var app: express.Express;
  var server: Server;
  var testApi: any; // Using 'any' to avoid type issues with supertest
}

// Global test setup
beforeAll(async () => {
  try {
    // Run migrations on test database
    await testDb.migrate.latest();

    // Import app after environment variables are set
    const { app } = await import('../src/server');

    // Assign app to global variable
    global.app = app;
    global.db = testDb;

    // Make db available in app
    app.locals.db = testDb;

    // Start the server
    return new Promise<void>((resolve) => {
      const server = app.listen(0, 'localhost', () => {
        global.server = server;
        const address = server.address();
        if (address && typeof address === 'object') {
          const baseUrl = `http://localhost:${address.port}`;
          // Initialize testApi with supertest
          global.testApi = require('supertest')(app); // Use the app directly with supertest
          console.log(`Test server running at ${baseUrl}`);
        } else {
          console.error('Could not determine server address');
        }
        resolve();
      });
    });
  } catch (error) {
    console.error('Error in test setup:', error);
    throw error;
  }
});

// Global test teardown
afterAll(async () => {
  // Close the server
  if (global.server) {
    await new Promise<void>((resolve, reject) => {
      global.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // Clean up database after tests
  if (global.db) {
    await global.db.migrate.rollback({}, true);
    await global.db.destroy();
  }
});

export { testDb };
