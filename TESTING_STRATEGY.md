# Testing Strategy

This document explains how tests are organized, what is covered, and how to run them locally and in CI.

## Goals

- Achieve and maintain ≥ 80% coverage across statements, branches, functions, and lines for `src/`.
- Keep tests fast, deterministic, and isolated (no real network/gateway calls).
- Mock external systems consistently: database (Knex), queue (BullMQ), and HMAC validator.

## Test Types

- **Unit Tests** (`tests/unit/`)
  - Validate controller behavior and service domain logic.
  - Use Jest spies/mocks on downstream dependencies (e.g., services, DB, gateway).
  - Examples:
    - `authController.test.ts`
    - `paymentsController.test.ts`
    - `authService.test.ts`
    - `transactionService.test.ts`

- **Integration Tests** (`tests/integration/`)
  - Optional, guarded by environment. Use Supertest to make requests against an Express app instance.
  - Heavy setup is gated behind `RUN_INTEGRATION=true` to avoid side effects by default.

## Global Setup & Mocks

- `tests/setupMocks.ts` and `tests/setupTests.ts` define global Jest mocks.
  - **Logger** is mocked to prevent I/O noise.
  - **HMAC Validator** is replaced by a test-safe implementation (lazy `getHmacValidator()`).
  - **Knex** is mocked with a callable transaction (`trx(table)`) and per-table APIs.
  - **BullMQ** queue config is mocked, and the worker is disabled in `NODE_ENV=test`.

## Mocking Guidelines

- **DB (Knex)**
  - For service tests, mock `db('table')` chains with `insert().returning()`, `where().first()`, `update().returning()`.
  - In controller tests, mock the service layer (not the DB) for speed and clearer intent.

- **Authorize.Net**
  - Mock service functions (`purchase`, `authorize`, `capture`, `void`, `refund`) to return simplified responses.

- **HMAC**
  - Use the manual mock: it returns `true` for validate paths by default and can be toggled in test cases.

- **BullMQ**
  - Do not run a real worker in unit tests. The worker is guarded in code; queue operations are mocked.

## Coverage

- Threshold target: ≥ 80% for statements/branches/functions/lines.
- Run locally:

```bash
npm run test:ci
```

- CI (GitHub Actions): `.github/workflows/ci.yml` builds, runs migrations, executes tests with coverage, and uploads artifacts.

## Common Patterns

- **Idempotency Paths**
  - For `purchase`, mock `transactionService.checkIdempotency` to return a cached response and assert that controller short-circuits.
  - For happy path, assert `createIdempotencyKey` is invoked with the correct request/response data.

- **Validation Failures**
  - Controllers should return `400` for invalid input.
  - Auth endpoints should fail on `validationResult` errors.

- **Error Handling**
  - Force errors with mocks and assert controllers return standardized JSON with appropriate status codes.

## Running Integration Tests (Optional)

- Integration setup is disabled by default to avoid heavy DB/server startup.
- To enable:

```bash
RUN_INTEGRATION=true npm test
```

This triggers `tests/setup.ts` which will run the test environment setup and teardown.
