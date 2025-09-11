import pino from 'pino';
import { Request, Response, NextFunction } from 'express';

// Create a simple logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname,reqId',
    },
  },
  // @ts-ignore - We're intentionally not providing all required properties
  msgPrefix: '',
});

// Extend Express Request type to include logger
declare global {
  namespace Express {
    interface Request {
      log: typeof logger;
      id?: string;
    }
  }
}

// Export the logger instance

// Middleware to add logger to the request object
export const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Create a child logger for this request
  const childLogger = logger.child({
    correlationId: req.id || 'unknown',
    path: req.path,
    method: req.method,
  });

  // Add the logger to the request object with type assertion
  req.log = childLogger as any;

  // Log the request
  childLogger.info(
    {
      type: 'request',
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(
        Object.entries(req.headers).filter(
          ([key]) => !['authorization', 'cookie', 'set-cookie'].includes(key.toLowerCase())
        )
      ),
    },
    'Request received'
  );

  // Log the response when it's finished
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      type: 'response',
      status: res.statusCode,
      duration: `${duration}ms`,
      headers: res.getHeaders(),
    };

    if (res.statusCode >= 500) {
      childLogger.error(logData, 'Server error');
    } else if (res.statusCode >= 400) {
      childLogger.warn(logData, 'Client error');
    } else {
      childLogger.info(logData, 'Request completed');
    }
  });

  // Continue to the next middleware
  next();
};

// Export the logger instance for use in other modules
export { logger };
