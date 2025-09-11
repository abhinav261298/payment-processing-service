import { Request, Response } from 'express';
import validator from 'express-validator';
import { SubscriptionService } from '../services/subscriptionService';
import { AppError } from '../middleware/error.middleware';

export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  /**
   * Create a new subscription
   */
  async createSubscription(req: Request, res: Response) {
    const { validationResult } = validator as any;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', { errors: errors.array() });
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const subscriptionData = {
      userId,
      name: req.body.name,
      description: req.body.description,
      amount: parseFloat(req.body.amount),
      currency: req.body.currency || 'USD',
      interval: req.body.interval,
      intervalCount: req.body.intervalCount || 1,
      paymentMethodId: req.body.paymentMethodId,
      hasTrial: req.body.hasTrial || false,
      trialDays: req.body.trialDays,
      metadata: req.body.metadata,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
    };

    const subscription = await this.subscriptionService.createSubscription(subscriptionData);

    res.status(201).json({
      success: true,
      data: subscription,
    });
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(req: Request, res: Response) {
    const subscriptionId = req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const subscription = await this.subscriptionService.cancelSubscription(subscriptionId, userId);

    res.json({
      success: true,
      data: subscription,
    });
  }

  /**
   * Get subscription details
   */
  async getSubscription(req: Request, res: Response) {
    const subscriptionId = req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const subscription = await this.subscriptionService.getSubscription(subscriptionId, userId);

    res.json({
      success: true,
      data: subscription,
    });
  }

  /**
   * List user's subscriptions
   */
  async listSubscriptions(req: Request, res: Response) {
    const userId = req.user?.id;
    const { status, limit = 10, offset = 0 } = req.query;

    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    // In a real implementation, this would fetch paginated results from the database
    // For now, we'll return an empty array as a placeholder
    const subscriptions: any[] = [];
    const total = 0;

    res.json({
      success: true,
      data: {
        items: subscriptions,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
        },
      },
    });
  }
}

export default SubscriptionController;
