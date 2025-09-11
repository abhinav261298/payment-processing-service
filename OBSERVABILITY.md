# Observability

This document describes logging, metrics, health checks, and tracing approaches adopted by the Payment Processing Service.

## Logging

- **Logger**: Pino (`src/utils/logger.ts`)
- **Format**: JSON logs suitable for ingestion by ELK/Datadog/Grafana Loki.
- **Context**: Correlation IDs and request IDs propagated via `src/middleware/correlation.ts`.
- **Sensitive Data**: Never log PAN/CVV or secrets. Mask email/PII if required by policy.

### Log Examples

```
{"level":"info","msg":"Processing webhook event","eventId":"evt_123","eventType":"net.authorize.payment.capture.created","attempt":1}
{"level":"error","msg":"Error processing webhook event (will retry)","eventId":"evt_123","error":"DB timeout","attempt":1,"willRetry":true,"nextRetryIn":"1000ms"}
```

## Metrics

- **Library**: `prom-client`
- **Recommended Metrics**:
  - Counters: `http_requests_total{route,method,status}`, `webhook_processed_total{event_type,status}`
  - Histograms: `http_request_duration_seconds{route,method}`, `webhook_processing_duration_seconds{event_type}`
  - Gauges: `queue_jobs_active`, `queue_jobs_delayed`

### Sample Initialization

```ts
import client from 'prom-client';

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['route', 'method', 'status'] as const,
});
registry.registerMetric(httpRequests);
```

Expose metrics via `/metrics` route (already present in `src/routes/metrics.ts`).

## Health & Readiness

- **Liveness**: `GET /healthz` checks process/loop.
- **Readiness**: `GET /readyz` checks DB and Redis connectivity.
- Include queue depth checks for BullMQ (optional) to gate traffic.

## Tracing

- Add OpenTelemetry SDK (optional) to export traces to Jaeger/Tempo.
- Instrument inbound HTTP, DB calls, and queue worker spans.
- Propagate trace context across async boundaries (HTTP -> worker).

## Alerting

- Alert on:
  - Elevated 5xx rate or latency p95/p99.
  - Spike in `webhook_events` `failed` status.
  - Queue backlog size above threshold.
  - DB connection pool saturation.

## Dashboards

- Suggested panels:
  - Request rate, error rate, latency percentiles.
  - Webhook success/failure rate by event type.
  - Queue depth and processing duration.
  - DB slow queries and connection usage.

## Runbook (Incidents)

1. Check `/metrics` for failing subsystem signals.
2. Inspect logs by `correlationId`/`eventId`.
3. Verify DB/Redis connectivity.
4. If worker backlog rises, consider scaling the worker (`concurrency`) or cluster replicas.
5. For recurrent failures, examine event payloads and retry/backoff policy.

## Compliance Notes

- Retain logs per policy; encrypt at rest; limit access via RBAC.
- Avoid logging secrets/keys; scrub headers (`Authorization`, `x-anet-signature`).
- Ensure metrics/traces do not include PII without justification and safeguards.
