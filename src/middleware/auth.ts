import { Request, Response, NextFunction, RequestHandler } from 'express';
import { authService } from '../services/authService';
import { User } from '../types/database';
import { AppError } from './error.middleware';

declare global {
  namespace Express {
    interface Request {
      user?: Omit<User, 'password_hash'>;
    }
  }
}

/**
 * Middleware to authenticate requests using JWT token
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new AppError('No authentication token provided', 401, 'UNAUTHENTICATED');
    }

    // Verify token
    const decoded = authService.verifyToken(token);

    // Get user from token
    const user = await authService.getUserById(decoded.userId);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'));
    }
  }
};

/**
 * Higher-order function to require authentication for a route
 * Can be used as a middleware factory for role-based access control
 */
export function authenticate(roles?: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    authMiddleware(req, res, (err) => {
      if (err) return next(err);

      // If no specific roles required, just check if user is authenticated
      if (!roles || roles.length === 0) {
        return next();
      }

      // Check if user has one of the required roles
      if (!req.user || !roles.includes(req.user.role)) {
        return next(
          new AppError('You do not have permission to access this resource', 403, 'FORBIDDEN')
        );
      }

      next();
    });
  };
}

/**
 * Middleware to check if the authenticated user is the same as the requested user
 * or has admin privileges
 */
export const authorizeUser = (req: Request, res: Response, next: NextFunction) => {
  const requestedUserId = req.params.userId || req.body.userId;

  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
  }

  // Allow if user is admin or is the same user
  if (req.user.role === 'admin' || req.user.id === requestedUserId) {
    return next();
  }

  next(new AppError('Not authorized to access this resource', 403, 'UNAUTHORIZED'));
};
