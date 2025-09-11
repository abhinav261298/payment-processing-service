import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

// Define a generic validation error interface
export interface ValidationError {
  param: string;
  msg: string;
  value?: any;
}

// Custom error classes
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(errors: ValidationError[]) {
    super('Validation failed', 400, 'VALIDATION_ERROR', { errors });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitExceededError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  // Handle known error types
  let status = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details = undefined;

  // Handle custom AppError instances
  if (error instanceof AppError) {
    status = error.statusCode;
    code = error.code || 'APPLICATION_ERROR';
    message = error.message;
    details = error.details;
  }
  // Handle JWT errors
  else if (error instanceof JsonWebTokenError) {
    status = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (error instanceof TokenExpiredError) {
    status = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  }
  // Handle other common error types
  else if (error.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
  } else if (error.name === 'MongoError' && (error as any).code === 11000) {
    status = 409;
    code = 'DUPLICATE_KEY';
    message = 'Duplicate key error';
  }

  // Log the error for debugging
  const logContext = {
    error: {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      code: (error as any).code,
      details,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      // Exclude potentially sensitive data from logs
      // body: req.body,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-request-id': req.headers['x-request-id'],
        'x-correlation-id': req.headers['x-correlation-id'],
      },
    },
  };

  if (status >= 500) {
    logger.error('Server error occurred', logContext);
  } else {
    logger.warn('Client error occurred', logContext);
  }

  // Prepare error response
  const response: any = {
    success: false,
    error: {
      code,
      message,
      ...(process.env.NODE_ENV !== 'production' && { details }),
    },
  };

  // Add trace ID for error correlation
  const traceId = req.headers['x-request-id'] || req.id;
  if (traceId) {
    response.traceId = traceId;
  }

  res.status(status).json(response);
};

// Unified not found handler
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  });
};
