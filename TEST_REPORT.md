# Test Report (Sample)

Date: 2025-09-10
Commit: <mocked-sha>

## Summary

- Overall coverage (mocked):
  - Statements: 86%
  - Branches: 84%
  - Functions: 85%
  - Lines: 87%

## Coverage by Area (mocked)

- Controllers
  - `src/controllers/authController.ts`: 88% lines
  - `src/controllers/paymentsController.ts`: 85% lines
- Services
  - `src/services/authService.ts`: 84% lines
  - `src/services/transactionService.ts`: 90% lines
- Workers
  - `src/workers/processWebhooks.ts`: exercised indirectly in unit tests for logic; dedicated worker runtime is excluded from unit scope.

## Highlights

- __Auth Controller__
  - Registration and login success paths validated.
  - Validation and error paths covered.
  - `getCurrentUser` covers 401/404/success.

- __Payments Controller__
  - `purchase` covers idempotency cache, validation errors, success log/update, and gateway failure.
  - `capture`, `void`, `refund` cover 400 validation and 200 success.
  - `getTransaction` covers 404, 403, and 200 success.

- __Auth Service__
  - Register: existing email error, happy path returns token.
  - Login: invalid email or password errors, success path returns token.

- __Transaction Service__
  - Create/Update/Fetch covered.
  - Idempotency: `checkIdempotency` null and cached response; `createIdempotencyKey` persists with 24h expiry.

## Not Covered (Next Up)

- Authorize.Net service client adapter: stubbed in unit tests; integration or contract tests could be added with a fake gateway.
- Webhook route end-to-end (HMAC header): currently validated via unit tests in worker logic; a lightweight route test can be added.

## How to Reproduce Locally

```bash
# Run unit tests with coverage
npm run test:ci

# View HTML report
open coverage/lcov-report/index.html
```

## Notes

- Coverage numbers are representative (mocked) to illustrate the reporting format. CI will produce real coverage and upload the `coverage/` artifact.
