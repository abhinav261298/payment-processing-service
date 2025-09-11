# Payment Processing Service

## Useful Commands

- __App (local)__
  - `npm run dev` – start dev server with hot-reload
  - `npm run build` – compile TypeScript to `dist/`
  - `npm start` – start the production server from `dist/`

- __Testing__
  - `npm test` – run unit tests
  - `npm run test:integration` – run integration tests
  - `npm run test:coverage` – run tests with coverage

- __Lint & Format__
  - `npm run lint` – lint all sources
  - `npm run lint:fix` – auto-fix lint issues where possible
  - `npm run format` – format code with Prettier

- __Database (Knex)__
  - `npm run migrate` – apply latest migrations and run seeds
  - `npm run migrate:latest` – apply latest migrations only
  - `npm run migrate:rollback` – rollback last migration batch
  - `npm run migrate:make -- <name>` – create a new migration
  - `npm run seed` – run seeds
  - `npm run seed:run` – run seeds
  - `npm run seed:make -- <name>` – create a new seed

- __Docker / Compose__
  - `npm run compose:up` – build and start all services
  - `npm run compose:down` – stop and remove containers and volumes
  - `npm run compose -- <args>` – pass arbitrary args to Compose wrapper
  - Note: Postgres is mapped to the host on port `5433` (container port `5432`).

A robust payment processing service built with Node.js, TypeScript, Express, PostgreSQL, BullMQ, and Redis. It provides a secure and scalable way to handle payments, subscriptions, idempotent operations, and webhook-driven workflows.

## Features

- **User Authentication**: JWT-based authentication with role-based access control
- **Payment Processing**: Secure credit card processing via Authorize.Net
  - One-time payments
  - Authorization and capture
  - Refunds and voids
  - Idempotent operations
- **Transaction Management**: Comprehensive transaction tracking and history
- **Subscription Billing**: Recurring billing with customizable plans
- **Webhook Handling**: Real-time payment event notifications
- **Idempotency**: Safe retry logic for failed requests
- **Comprehensive Logging**: Structured logging for all operations
- **Error Handling**: Consistent error responses and status codes
- **Input Validation**: Request validation middleware
- **Testing**: Unit and integration test coverage

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Knex.js for query building
- **Queue**: BullMQ (Redis)
- **Payment Gateway**: Authorize.Net SDK
- **Authentication**: JWT (JSON Web Tokens)
- **Testing**: Jest, Supertest
- **Logging**: Pino
- **Containerization**: Docker
- **CI/CD**: GitHub Actions

## Prerequisites

- Node.js (v16 or later)
- PostgreSQL (v12 or later)
- npm or yarn
- Authorize.Net developer account

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/payment-processing-service.git
cd payment-processing-service
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file and update it with your configuration:

```bash
cp .env.example .env
```

Update the `.env` file with your specific settings:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/payment_processing
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/payment_processing_test

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1d

# Authorize.Net
AUTHORIZE_NET_API_LOGIN_ID=your_login_id
AUTHORIZE_NET_TRANSACTION_KEY=your_transaction_key
AUTHORIZE_NET_ENVIRONMENT=sandbox  # or production

# Logging
LOG_LEVEL=info
```

### 4. Database Setup

1. Create a new PostgreSQL database:
   ```bash
   createdb payment_processing
   createdb payment_processing_test
   ```

2. Run database migrations:
   ```bash
   npm run migrate
   ```

3. (Optional) Seed the database with test data:
   ```bash
   npm run seed
   ```

## Running the Application

### Development Mode

```bash
npm run dev
```

The server will start on `http://localhost:3000` by default.

### Production Mode

```bash
npm run build
npm start
```

## API Documentation

### Authentication

All endpoints except `/api/auth/*` require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

### Endpoints

#### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Authenticate and get JWT token
- `GET /api/auth/me` - Get current user profile

#### Payments

- `POST /api/payments/purchase` - Process a payment
- `POST /api/payments/authorize` - Authorize a payment
- `POST /api/payments/capture` - Capture an authorized payment
- `POST /api/payments/void` - Void a transaction
- `POST /api/payments/refund` - Process a refund
- `GET /api/payments/transactions/:id` - Get transaction details

#### Webhooks

- `POST /api/webhooks/authorizenet` - Receive Authorize.Net webhook events (HMAC validated)

### Request Headers

- `X-Idempotency-Key`: Required for all payment endpoints to ensure idempotency
- `X-Request-ID`: Optional request identifier for tracing
- `X-Correlation-ID`: Optional correlation ID for distributed tracing

## Request/Flow Examples

### Authorization + Capture Flow (Sync)

1) Create a purchase (example):

```bash
curl -X POST http://localhost:3000/api/payments/purchase \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: 5bb6c1f8-2d3a-4d61-9c8f-02b7e2f9a001" \
  -d '{
    "amount": 4999,
    "currency": "USD",
    "paymentMethod": {
      "cardNumber": "4111111111111111",
      "expMonth": "12",
      "expYear": "2028",
      "cvc": "123"
    },
    "metadata": {"orderId": "ord_123"}
  }'
```

2) Get a transaction by ID:

```bash
curl http://localhost:3000/api/payments/transactions/txn_123
```

### Webhook Ingestion Flow

```bash
curl -X POST http://localhost:3000/api/webhooks/authorizenet \
  -H "Content-Type: application/json" \
  -H "x-anet-event-type: net.authorize.payment.capture.created" \
  -H "x-anet-signature: <hex-hmac-signature>" \
  --data-binary '{
    "id": "evt_abc",
    "type": "net.authorize.payment.capture.created",
    "payload": {"id": "py_123", "amount": 4999, "status": "succeeded"}
  }'
```

Notes:
- The HMAC signature is computed over the raw body using your `AUTHNET_SIGNATURE_KEY`.
- Valid events are enqueued to BullMQ for resilient async processing with retries and exponential backoff.

## System Flows

### 1) Payment Request Flow (Synchronous)

```
Client -> /api/payments/* -> Validation -> Authorize.Net SDK -> DB write (transactions)
                                     \-> Idempotency check (by key)
```

### 2) Webhook Processing Flow (Asynchronous)

```
Authorize.Net -> /api/webhooks/authorizenet -> HMAC validate -> Queue (BullMQ)
  Worker (BullMQ): dequeue -> process -> DB updates (webhook_events, transactions, subscriptions)
  Retry: exponential backoff (e.g., 1s, 2s, 4s) up to configured attempts
```

## Database Schema (Key Tables)

```text
users
  id (uuid PK)
  email (unique)
  first_name, last_name
  password_hash
  role
  created_at, updated_at

transactions
  id (uuid PK)
  transaction_id (gateway id, unique)
  amount numeric(10,2)
  currency varchar(3)
  status (completed|pending|failed|refunded)
  payment_method_id, order_id
  metadata jsonb
  created_at, updated_at

subscriptions
  id (uuid PK)
  subscription_id (gateway id, unique)
  status (active|canceled|expired|suspended|pending|past_due)
  customer_id
  current_period_start, current_period_end
  metadata jsonb
  created_at, updated_at

webhook_events
  id (uuid PK)
  event_id (string, unique)
  event_type (string)
  payload jsonb
  status (pending|processing|processed|failed)
  entity_type, entity_id
  processed_at
  error_message, error_stack
  retry_count
  metadata jsonb
  created_at, updated_at
```

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Test Coverage

```bash
npm run test:coverage
```

## Docker & Docker Compose

### docker-compose (App + Postgres + Redis)

Example `docker-compose.yml` (create at project root if not present):

```yaml
version: "3.9"
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: payment_processing
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  api:
    build: .
    depends_on:
      - db
      - redis
    environment:
      NODE_ENV: development
      DATABASE_URL: postgres://app:app@db:5432/payment_processing
      JWT_SECRET: dev-secret
      JWT_EXPIRES_IN: 1d
      AUTHORIZE_NET_API_LOGIN_ID: "test"
      AUTHORIZE_NET_TRANSACTION_KEY: "test"
      AUTHORIZE_NET_ENVIRONMENT: "sandbox"
      AUTHNET_SIGNATURE_KEY: "test-signature"
      REDIS_HOST: redis
    ports:
      - "3000:3000"
    command: ["npm", "run", "dev"]

volumes:
  pgdata: {}
```

Run compose:

```bash
docker-compose up --build
```

Initialize DB (in another terminal):

```bash
npm run migrate
```

### Kubernetes

Example deployment configuration is provided in the `k8s/` directory.

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Port to run the server | No | `3000` |
| `NODE_ENV` | Application environment | No | `development` |
| `DATABASE_URL` | PostgreSQL connection URL | Yes | - |
| `JWT_SECRET` | Secret for signing JWT tokens | Yes | - |
| `JWT_EXPIRES_IN` | JWT token expiration time | No | `1d` |
| `AUTHORIZE_NET_API_LOGIN_ID` | Authorize.Net API login ID | Yes | - |
| `AUTHORIZE_NET_TRANSACTION_KEY` | Authorize.Net transaction key | Yes | - |
| `AUTHORIZE_NET_ENVIRONMENT` | Authorize.Net environment (`sandbox` or `production`) | No | `sandbox` |
| `AUTHNET_SIGNATURE_KEY` | HMAC signature key for webhooks | Yes | - |
| `REDIS_HOST` | Redis host for BullMQ | No | `localhost` |
| `LOG_LEVEL` | Logging level | No | `info` |

## Error Handling

The API returns consistent error responses with the following format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

Common error codes:

- `VALIDATION_ERROR`: Request validation failed
- `UNAUTHORIZED`: Authentication required or invalid token
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource already exists
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_SERVER_ERROR`: Unexpected server error

## Security & Compliance (PCI-DSS Notes)

- Sensitive PAN data must never be persisted or logged. Tokenize cards via gateway.
- Use HTTPS/TLS everywhere; terminate at a compliant load balancer or ingress.
- Scope reduction: this service delegates storage/processing of card data to Authorize.Net.
- Rotate credentials and keys regularly. Store secrets in a secure vault.
- Enforce least-privilege access for DB and runtime identities.
- Keep dependency and OS security patches up-to-date. Monitor CVEs.
- Implement WAF/rate limiting at the edge for brute force protection.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository.


## Available Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build the application
- `npm start` - Start the production server
- `npm test` - Run tests
- `npm run lint` - Lint the codebase
- `npm run format` - Format the code
- `npm run migrate` - Run database migrations
- `npm run migrate:make <name>` - Create a new migration
- `npm run migrate:rollback` - Rollback the last migration

## Project Structure

See `PROJECT_STRUCTURE.md` for a full breakdown, scripts, and environment files.

## Architecture & Observability

Read more in `Architecture.md` (components/flows/retry policy) and `OBSERVABILITY.md` (logging, metrics, health, traces).

## License

ISC
