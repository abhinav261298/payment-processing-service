const ignoreIntegration = process.env.RUN_INTEGRATION !== 'true';

module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: [
    ...(ignoreIntegration ? ['<rootDir>/tests/integration/'] : []),
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true, // Improves test performance
    }],
  },
  testTimeout: 30000, // Increased timeout for integration tests
  setupFiles: ['dotenv/config'],
  setupFilesAfterEnv: [
    './tests/setupMocks.ts',
    './tests/setup.ts', // Our existing setup file
    './tests/setupTests.ts', // Our new test setup with mocks
    'jest-extended/all' // For additional matchers
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^vitest$': '<rootDir>/tests/__mocks__/vitest.ts',
  },
  extensionsToTreatAsEsm: ['.ts'],
  // Don't clear the console between tests (helps with debugging)
  verbose: true,
  // Watch configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
  // Disable coverage for now to speed up tests
  collectCoverage: false,
};
