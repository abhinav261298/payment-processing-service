# Project Structure

This document describes the layout, responsibilities, and key scripts of the Payment Processing Service.

## Repository Layout

```
.
├── migrations/                   # Knex migrations (DDL)
├── seeds/                        # Knex seeds (test/demo data)
├── scripts/                      # Utility scripts (e.g., DB tasks)
├── src/
│   ├── app.ts                    # Express app wiring (if present)
│   ├── server.ts                 # Application entrypoint (HTTP server)
│   ├── controllers/              # Request handlers and adapters
│   ├── routes/                   # Express routers (auth, payments, webhooks, etc.)
│   ├── services/                 # Business logic (Authorize.Net, subscriptions, payments)
│   ├── workers/                  # BullMQ workers and job processors
│   ├── queues/                   # BullMQ queue configuration
│   ├── middleware/               # Cross-cutting concerns (auth, errors, correlation)
│   ├── utils/                    # Logger, HMAC validator, helpers
│   ├── db/                       # Knex configuration + exports
│   └── types/                    # Database & domain types
│
├── tests/                        # Jest tests (unit/integration)
│   ├── setup.ts                  # Test environment setup (guarded by RUN_INTEGRATION)
│   ├── setupTests.ts             # Global Jest mocks (db, logger, queue, hmac)
│   ├── setupMocks.ts             # Pre-env mocks applied before tests
│   ├── integration/              # Integration tests (supertest)
│   └── unit/                     # Unit tests
│       └── workers/              # Worker-focused tests and retry logic
│
├── jest.config.js                # Jest configuration
├── knexfile.ts                   # Knex CLI configuration
├── tsconfig.json                 # TypeScript config for source
├── tsconfig.test.json            # TypeScript config for tests
├── .env.example                  # Example environment variables
└── docker-compose.yml            # (Optional) local docker-compose for app+db+redis
```

## Key Directories

- `src/controllers/`
  - Thin request handlers that validate inputs and call `services/` or `workers/`.

- `src/services/`
  - Business logic for interacting with Authorize.Net and domain models.
  - Example: `authorizenetService.ts`, `subscriptionService.ts`, `transactionService.ts`.

- `src/workers/`
  - BullMQ `Worker` definitions and job processing logic (e.g., `processWebhooks.ts`).
  - Resilient processing with retries and exponential backoff.

- `src/queues/`
  - Queue names, queue client configuration, shared queue options.

- `src/middleware/`
  - Cross-cutting concerns including `auth.ts`, `error.middleware.ts`, and `correlation.ts`.

- `src/utils/`
  - Support utilities (logger, HMAC validator, metrics helpers, etc.).

## Scripts

- `npm run dev` — Start the API in development mode with ts-node and hot reload.
- `npm run build` — Compile TypeScript to JavaScript in `dist/`.
- `npm start` — Start the compiled server (production-like).
- `npm test` — Run all tests with Jest.
- `npm run test:watch` — Watch mode for tests.
- `npm run migrate` — Run all migrations then seed.
- `npm run seed:run` — Run seeds only.
- `npm run lint` / `npm run lint:fix` — Lint the codebase and fix issues.

## Configuration Files

- `.env` — Local environment settings (copy from `.env.example`).
- `jest.config.js` — Maps module names, sets up global mocks, and enables ESM via ts-jest.
- `knexfile.ts` — Exposes environments for Knex CLI (development/test).
- `tsconfig.json` — Base TS config; `tsconfig.test.json` for Jest/ts-jest.

## Environments

- `development` — Default for local usage, verbose logs, dev error handling.
- `test` — Used by Jest. Worker is disabled at import time, HMAC validator is lazily instantiated.
- `production` — Optimized logging, worker enabled, real Authorize.Net.

## Data & Queues Overview

- PostgreSQL tables include `users`, `transactions`, `subscriptions`, `webhook_events`.
- Redis is used by BullMQ for job queues and retries.
- See `README.md` for schema summary.

## Docker Compose

- `docker-compose.yml` example in README. Bring up:

```bash
docker-compose up --build
npm run migrate
```

## Developer Tips

- Keep controllers thin; move domain logic into services.
- Never log sensitive card details (PAN/CVV). Use gateway tokens.
- Prefer typed interfaces from `src/types/` for DB and domain models.
- Favor idempotency keys for all payment mutation endpoints.
