import { Request, Response } from 'express';
import { logger } from '../utils/logger';

export const healthCheck = async (req: Request, res: Response) => {
  const healthCheck = {
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'Service is healthy',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  };

  try {
    // Here you can add additional health checks like database connection, etc.
    // Example:
    // await checkDatabaseConnection();

    logger.info('Health check successful');
    return res.status(200).json(healthCheck);
  } catch (error) {
    logger.error('Health check failed', { error });
    return res.status(503).json({
      ...healthCheck,
      status: 'DOWN',
      message: 'Service unavailable',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
