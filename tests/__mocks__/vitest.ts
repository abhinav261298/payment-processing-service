// Shim to allow tests written for Vitest to run under Jest
// Maps `vitest` imports to Jest-compatible APIs

export const vi = Object.assign(Object.create(null), {
  fn: jest.fn.bind(jest),
  spyOn: jest.spyOn.bind(jest),
  mock: jest.mock.bind(jest),
  unmock: jest.unmock.bind(jest),
  resetAllMocks: jest.resetAllMocks.bind(jest),
  clearAllMocks: jest.clearAllMocks.bind(jest),
  restoreAllMocks: jest.restoreAllMocks ? jest.restoreAllMocks.bind(jest) : () => {},
});

// Re-export common test globals so `import { describe, it, expect } from 'vitest'` works
export {
  describe,
  it,
  test,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  expect,
} from '@jest/globals';
