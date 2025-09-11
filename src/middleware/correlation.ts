import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Middleware to add correlation ID to requests
 * If the request has an X-Correlation-ID header, it will be used.
 * Otherwise, a new UUID v4 will be generated.
 */
export const correlationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Use existing correlation ID or generate a new one
  const correlationId = (req.headers && req.headers['x-correlation-id']?.toString()) || uuidv4();

  // Set the correlation ID on the request object
  req.id = correlationId;

  // Set the correlation ID in the response headers
  res.setHeader('X-Correlation-ID', correlationId);

  next();
};
