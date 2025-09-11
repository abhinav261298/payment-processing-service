// Note: Avoid importing heavy helpers at module load to prevent side effects in unit tests
// We'll dynamically import them only when RUN_INTEGRATION=true
// import { setupTestEnvironment } from './testHelpers';
// import { TEST_CONFIG } from './testConfig';

// Only run heavy global setup for integration/e2e when explicitly enabled
if (process.env.RUN_INTEGRATION === 'true') {
  beforeAll(async () => {
    const { setupTestEnvironment } = await import('./testHelpers');
    const { TEST_CONFIG } = await import('./testConfig');
    await setupTestEnvironment();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = TEST_CONFIG.JWT_SECRET;
    process.env.JWT_EXPIRES_IN = TEST_CONFIG.JWT_EXPIRES_IN;
  });
}

// Clean up only when integration setup ran
if (process.env.RUN_INTEGRATION === 'true') {
  afterAll(async () => {
    const { teardownTestEnvironment } = await import('./testHelpers');
    await teardownTestEnvironment();
  });
}

// Global test error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optionally exit with a non-zero code to fail the test run
  // process.exit(1);
});

// Ensure we don't have memory leaks from event listeners
process.on('warning', (warning) => {
  console.warn('Node.js warning:', warning);
});
