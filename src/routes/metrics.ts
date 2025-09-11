import { Router } from 'express';
import { collectDefaultMetrics, Registry, Gauge, Counter, Histogram } from 'prom-client';

// Create a registry to hold the metrics
const register = new Registry();

// Enable default metrics collection
collectDefaultMetrics({ register });

// Define custom metrics
const httpRequestDurationMicroseconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'code'],
});

const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
});

// Register the metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestsTotal);
register.registerMetric(activeConnections);

// Middleware to track request metrics
export const metricsMiddleware = (req: any, res: any, next: any) => {
  // Skip metrics endpoint itself
  if (req.path === '/metrics') {
    return next();
  }

  const start = process.hrtime();
  const path = req.route ? req.route.path : req.path;

  // Track active connections
  activeConnections.inc();

  res.on('finish', () => {
    const duration = process.hrtime(start);
    const responseTimeInMs = duration[0] * 1000 + duration[1] / 1e6;

    // Record metrics
    httpRequestDurationMicroseconds
      .labels(req.method, path, res.statusCode)
      .observe(responseTimeInMs / 1000);

    httpRequestsTotal.inc({
      method: req.method,
      route: path,
      code: res.statusCode,
    });

    // Decrement active connections
    activeConnections.dec();
  });

  next();
};

// Create router
export const metricsRouter = Router();

// Metrics endpoint
metricsRouter.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (err) {
    res.status(500).end('Error generating metrics');
  }
});

export default metricsRouter;
