import { Request, Response, NextFunction } from 'express';
import validator from 'express-validator';
import { AppError } from './error.middleware';

/**
 * Middleware to validate request using express-validator
 * @param validations Array of validation chains
 * @returns Middleware function
 */
const { validationResult } = validator as any;

export const validateRequest = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors: Record<string, string> = {};
    errors.array().forEach((err: any) => {
      if (err.type === 'field') {
        extractedErrors[err.path] = err.msg;
      }
    });

    throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', { errors: extractedErrors });
  };
};

/**
 * Middleware to validate request body
 * @param validations Array of validation chains
 * @returns Middleware function
 */
export const validateRequestBody = (validations: any[]) => {
  return validateRequest(validations);
};

/**
 * Middleware to validate request query
 * @param validations Array of validation chains
 * @returns Middleware function
 */
export const validateRequestQuery = (validations: any[]) => {
  return validateRequest(validations);
};

/**
 * Middleware to validate request params
 * @param validations Array of validation chains
 * @returns Middleware function
 */
export const validateRequestParams = (validations: any[]) => {
  return validateRequest(validations);
};
