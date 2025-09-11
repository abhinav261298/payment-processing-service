import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { db } from './db/knex';
import { healthCheckRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { metricsRouter, metricsMiddleware } from './routes/metrics';
import { correlationMiddleware, loggerMiddleware, errorHandler } from './middleware';

export const app = express();

const port = process.env.PORT || 3000;

// Core middleware
app.use(cors());
app.use(express.json());

// Custom middleware
app.use(correlationMiddleware);
app.use(loggerMiddleware);
app.use(metricsMiddleware);

// Make db accessible in routes
app.locals.db = db;

// Routes
app.use('/health', healthCheckRouter);
app.use('/api/auth', authRouter);
app.use(metricsRouter);

// Health check endpoint (kept for backward compatibility)
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    message: 'Service is healthy',
    environment: process.env.NODE_ENV || 'development',
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const server = createServer(app);
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Health check available at http://localhost:${port}/health`);
  console.log(`API Documentation available at http://localhost:${port}/api-docs`);
});

// Handle shutdown
const shutdown = async () => {
  console.log('Shutting down server...');
  try {
    await db.destroy();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
