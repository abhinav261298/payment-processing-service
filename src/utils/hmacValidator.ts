import * as crypto from 'crypto';
import { Request, Response, NextFunction, RequestHandler } from 'express';

// Extend Express Request type to include rawBody
declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

export class HmacValidator {
  private secretKey: string;

  /**
   * Creates a new HmacValidator instance
   * @param secretKey Optional HMAC secret key (falls back to AUTHNET_SIGNATURE_KEY env var)
   */
  constructor(secretKey?: string) {
    const key = secretKey || process.env.AUTHNET_SIGNATURE_KEY;
    if (!key) {
      throw new Error(
        'HMAC secret key is required. Either pass it to the constructor or set AUTHNET_SIGNATURE_KEY environment variable'
      );
    }
    this.secretKey = key;
  }

  /**
   * Creates a new HmacValidator instance (alternative to constructor for better testability)
   * @param secretKey Optional HMAC secret key (falls back to AUTHNET_SIGNATURE_KEY env var)
   */
  static create(secretKey?: string): HmacValidator {
    return new HmacValidator(secretKey);
  }

  /**
   * Validates the HMAC signature of a webhook payload
   * @param payload Raw request body as string
   * @param signatureHeader Signature from 'X-Anet-Signature' header
   * @returns boolean indicating if the signature is valid
   */
  public isValidSignature(payload: string, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) {
      return false;
    }

    try {
      const hmac = crypto.createHmac('sha512', this.secretKey);
      const expectedSignature = hmac.update(payload).digest('hex');

      // Ensure both buffers are of the same length
      const signatureBuffer = Buffer.from(signatureHeader, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (signatureBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error validating HMAC signature:', errorMessage);
      return false;
    }
  }

  /**
   * Middleware for Express to validate HMAC signature
   */
  public middleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const signature = req.header('x-anet-signature');
      const rawBody = req.rawBody || JSON.stringify(req.body);

      if (!this.isValidSignature(rawBody, signature)) {
        return res.status(401).json({
          error: 'Invalid signature',
          message: 'The request signature is invalid',
        });
      }

      next();
    };
  }
}

// Provide a lazy singleton accessor instead of eagerly creating an instance at import time.
// This prevents throwing during test/module import when AUTHNET_SIGNATURE_KEY is not set.
let _hmacSingleton: HmacValidator | null = null;
export function getHmacValidator(secretKey?: string): HmacValidator {
  if (!_hmacSingleton) {
    _hmacSingleton = HmacValidator.create(secretKey);
  }
  return _hmacSingleton;
}
