# Architecture

This document outlines the architecture, core components, workflows, retry/backoff policies, and operational concerns of the Payment Processing Service.

## Components

- **API (Express + TypeScript)**
  - Routes: `auth`, `payments`, `subscriptions`, `metrics`, `webhooks`.
  - Middleware: `auth`, `error.middleware`, `correlation`.
  - Controllers: thin adapters that call services.

- **Services (Domain Logic)**
  - `authorizenetService.ts`, `transactionService.ts`, `subscriptionService.ts`, `authService.ts`.
  - Encapsulate gateway interactions and business rules.

- **Queues (BullMQ)**
  - Defined in `src/queues/config.ts` with `QueueName.WEBHOOK_EVENTS`.
  - Redis-backed, used for resilient webhook processing.

- **Workers**
  - `src/workers/processWebhooks.ts`: consumes webhook jobs, updates DB, and handles retries.
  - Worker is not started during unit tests (guarded by `NODE_ENV !== 'test'`).

- **Database (PostgreSQL + Knex)**
  - Core tables: `users`, `transactions`, `subscriptions`, `webhook_events`.
  - See schema summary in `README.md`.

- **Observability**
  - Logging via Pino.
  - Health endpoints and metrics via `prom-client` (see `OBSERVABILITY.md`).

## High-Level Flow

### Sync Payments
```
Client -> /api/payments/* -> Validation -> Authorize.Net SDK -> DB write (transactions)
                                   \-> Idempotency check
```

### Webhooks (Async)
```
Authorize.Net -> /api/webhooks/authorizenet -> HMAC validation -> enqueue BullMQ job
Worker -> process job -> update DB (webhook_events, transactions, subscriptions)
Retry -> exponential backoff with bounded attempts
```

## HMAC Validation (Authorize.Net)
- Raw request body captured by `rawBodyMiddleware`.
- Header `x-anet-signature` compared using HMAC SHA-512 with `AUTHNET_SIGNATURE_KEY`.
- `src/utils/hmacValidator.ts` exposes a lazy getter `getHmacValidator()` to avoid import-time failures in tests.

## Retry & Backoff Policy
- Default attempts: 3 (configurable per job).
- Backoff: exponential (1s, 2s, 4s…) with a cap (e.g., 30s) — see `processWebhooks.ts` for logic.
- On retryable errors:
  - Event status updated to `pending` and metadata contains `nextRetryDelay`.
- On terminal errors or max attempts reached:
  - Event status updated to `failed` with `error_message` / `error_stack`.

## Idempotency
- Payment mutation endpoints require `X-Idempotency-Key`.
- Server-side dedupe ensures no duplicate charges when clients retry.

## Error Handling
- Centralized error middleware returns consistent JSON shapes.
- Input validation guards all public endpoints.

## Security & Compliance
- JWT-secured endpoints, least-privilege DB credentials.
- Never store PAN/CVV. Use tokens from gateway.
- See README for PCI-DSS notes.

## Deployment
- Containerized via Docker. Compose example includes API + PostgreSQL + Redis.
- Migrations/seeds managed by Knex.

## Configuration
- Key env vars: `DATABASE_URL`, `JWT_SECRET`, `AUTHORIZE_NET_*`, `AUTHNET_SIGNATURE_KEY`, `REDIS_HOST`.
- See `.env.example` and `README.md` for full list.
