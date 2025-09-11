import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { WebhookEvent } from '../types/database';
import { webhookQueue } from '../queues/config';
import { logger } from '../utils/logger';
import { getHmacValidator } from '../utils/hmacValidator';

// Extend Express Request type to include rawBody
declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

const router = Router();

// Middleware to capture raw body for HMAC validation
const rawBodyMiddleware: RequestHandler = (req, res, next) => {
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (chunks.length > 0) {
      req.rawBody = Buffer.concat(chunks).toString('utf8');
    }
    next();
  });

  req.on('error', (error: Error) => {
    next(error);
  });
};

// Middleware to validate required headers
const validateHeaders: RequestHandler = (req, res, next) => {
  const eventType = req.header('x-anet-event-type');
  const signature = req.header('x-anet-signature');

  if (!eventType || !signature) {
    return res.status(400).json({
      error: 'Missing required headers',
      required: ['x-anet-event-type', 'x-anet-signature'],
    });
  }

  next();
};

// Middleware to validate HMAC signature
const validateHmac: RequestHandler = (req, res, next) => {
  if (!req.rawBody) {
    return res.status(400).json({ error: 'Missing request body' });
  }

  const signature = req.header('x-anet-signature');
  if (!signature) {
    return res.status(400).json({ error: 'Missing X-Anet-Signature header' });
  }

  // Lazily get the validator to avoid env var checks at module import time
  const isValid = getHmacValidator().isValidSignature(req.rawBody, signature);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};

// Parse JSON body after validation
const parseJsonBody: RequestHandler = (req, res, next) => {
  try {
    if (req.rawBody) {
      req.body = JSON.parse(req.rawBody);
    }
    next();
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
};

// Webhook endpoint for Authorize.Net
router.post(
  '/authorizenet',
  rawBodyMiddleware,
  validateHeaders,
  validateHmac,
  parseJsonBody,
  async (req: Request, res: Response) => {
    try {
      const eventType = req.header('x-anet-event-type');
      const eventId = req.header('x-anet-signature');
      const payload = req.body;

      if (!eventType || !eventId) {
        return res.status(400).json({ error: 'Missing required headers' });
      }

      // Create webhook event with all required fields
      const webhookEvent: WebhookEvent = {
        id: uuidv4(),
        event_id: eventId,
        event_type: eventType,
        payload,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
        entity_type: null,
        entity_id: null,
        processed_at: null,
        error_message: null,
        error_stack: null,
        retry_count: 0,
        metadata: {},
      };

      logger.info(`Processed webhook event: ${webhookEvent.id}`, {
        eventId: webhookEvent.event_id,
        eventType: webhookEvent.event_type,
        status: webhookEvent.status,
      });

      // Add job to the queue
      await webhookQueue.add(`webhook:${eventType}:${eventId}`, webhookEvent, {
        jobId: `webhook:${eventType}:${eventId}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000, // 1s, 2s, 4s
        },
      });

      res.status(200).json({ received: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to process webhook event: ${req.header('x-anet-signature')}`, {
        eventId: req.header('x-anet-signature'),
        eventType: req.header('x-anet-event-type'),
        status: 'failed',
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        headers: req.headers,
      });

      res.status(500).json({
        error: 'Internal server error',
        message: errorMessage,
      });
    }
  }
);

export { router as webhookRouter };
