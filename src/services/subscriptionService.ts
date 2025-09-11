// @ts-nocheck
import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import {
  AuthorizeNetService,
  SubscriptionInput as ANetSubscriptionInput,
} from './authorizenetService';
import { TransactionService } from './transactionService';
import { AppError } from '../middleware/error.middleware';

// Define database enums to match the migration
export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
  PAST_DUE = 'past_due',
}

export enum SubscriptionInterval {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export interface SubscriptionInput {
  userId: string;
  name: string;
  description?: string;
  amount: number;
  currency?: string;
  interval: SubscriptionInterval;
  intervalCount?: number;
  paymentMethodId: string;
  hasTrial?: boolean;
  trialDays?: number;
  metadata?: Record<string, any>;
  startDate?: Date;
}

export interface Subscription extends Omit<SubscriptionInput, 'startDate'> {
  id: string;
  status: SubscriptionStatus;
  subscriptionId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SubscriptionService {
  constructor(
    private db: Knex,
    private authorizeNetService: AuthorizeNetService,
    private transactionService: TransactionService
  ) {}

  async createSubscription(input: SubscriptionInput): Promise<Subscription> {
    const trx = await this.db.transaction();

    try {
      // Calculate dates
      const now = new Date();
      const startDate = input.startDate || now;

      // Create subscription in database
      const subscriptionData = {
        id: uuidv4(),
        user_id: input.userId,
        name: input.name,
        description: input.description,
        amount: input.amount,
        currency: input.currency || 'USD',
        interval: input.interval,
        interval_count: input.intervalCount || 1,
        payment_method_id: input.paymentMethodId,
        has_trial: input.hasTrial || false,
        trial_days: input.trialDays || null,
        status: SubscriptionStatus.PENDING,
        subscription_id: null,
        starts_at: startDate,
        current_period_start: null,
        current_period_end: null,
        canceled_at: null,
        ended_at: null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        created_at: now,
        updated_at: now,
      };

      await trx('subscriptions').insert(subscriptionData);

      try {
        // Create subscription in Authorize.Net
        const anetInput: ANetSubscriptionInput = {
          name: input.name,
          amount: input.amount,
          interval: input.interval,
          intervalCount: input.intervalCount,
          paymentMethodId: input.paymentMethodId,
          startDate,
          trialDays: input.hasTrial ? input.trialDays : undefined,
        };

        const subscriptionData = await this.authorizeNetService.createSubscription(anetInput);

        // Update subscription with Authorize.Net ID
        const [updatedSubscription] = await trx('subscriptions')
          .where({ id: subscriptionData.id })
          .update({
            subscription_id: subscriptionData.subscriptionId,
            status: subscriptionData.status.toUpperCase() as SubscriptionStatus,
            current_period_start: subscriptionData.currentPeriodStart,
            current_period_end: subscriptionData.currentPeriodEnd,
            updated_at: new Date(),
          })
          .returning('*');

        await trx.commit();
        return this.mapDbSubscription(updatedSubscription);
      } catch (error) {
        // If Authorize.Net fails, update subscription status to failed
        await trx('subscriptions').where({ id: subscriptionData.id }).update({
          status: SubscriptionStatus.SUSPENDED,
          updated_at: new Date(),
        });

        throw new AppError(
          'Failed to create subscription with payment provider',
          500,
          'SUBSCRIPTION_CREATION_FAILED',
          { originalError: error.message }
        );
      }
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string, userId: string): Promise<Subscription> {
    const trx = await this.db.transaction();

    try {
      // Get subscription
      const subscription = await trx('subscriptions')
        .where({ id: subscriptionId, user_id: userId })
        .first();

      if (!subscription) {
        throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
      }

      if (
        [SubscriptionStatus.CANCELED, SubscriptionStatus.EXPIRED, 'ended'].includes(
          subscription.status
        )
      ) {
        throw new AppError(
          'Subscription is already canceled or expired',
          400,
          'INVALID_SUBSCRIPTION_STATE'
        );
      }

      try {
        // Cancel in Authorize.Net if we have a subscription ID
        if (subscription.subscription_id) {
          await this.authorizeNetService.cancelSubscription(subscription.subscription_id);
        }

        // Update subscription in database
        const now = new Date();
        const [updatedSubscription] = await trx('subscriptions')
          .where({ id: subscriptionId })
          .update({
            status: SubscriptionStatus.CANCELED,
            canceled_at: now,
            ended_at: now,
            updated_at: now,
          })
          .returning('*');

        await trx.commit();
        return this.mapDbSubscription(updatedSubscription);
      } catch (error) {
        // If Authorize.Net fails, still mark as canceled in our DB but log the error
        console.error('Failed to cancel subscription in Authorize.Net:', error);

        const now = new Date();
        const [updatedSubscription] = await trx('subscriptions')
          .where({ id: subscriptionId })
          .update({
            status: SubscriptionStatus.CANCELED,
            canceled_at: now,
            ended_at: now,
            updated_at: now,
            metadata: JSON.stringify({
              ...(subscription.metadata ? JSON.parse(subscription.metadata) : {}),
              cancelError: 'Failed to cancel in payment provider',
              cancelErrorDetails: error.message,
            }),
          })
          .returning('*');

        await trx.commit();
        return this.mapDbSubscription(updatedSubscription);
      }
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async getSubscription(subscriptionId: string, userId: string): Promise<Subscription> {
    const subscription = await this.db('subscriptions')
      .where({ id: subscriptionId, user_id: userId })
      .first();

    if (!subscription) {
      throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    return this.mapDbSubscription(subscription);
  }

  private mapDbSubscription(dbSubscription: any): Subscription {
    return {
      id: dbSubscription.id,
      userId: dbSubscription.user_id,
      name: dbSubscription.name,
      description: dbSubscription.description,
      amount: parseFloat(dbSubscription.amount),
      currency: dbSubscription.currency,
      interval: dbSubscription.interval as SubscriptionInterval,
      intervalCount: dbSubscription.interval_count,
      paymentMethodId: dbSubscription.payment_method_id,
      hasTrial: dbSubscription.has_trial,
      trialDays: dbSubscription.trial_days,
      status: dbSubscription.status as SubscriptionStatus,
      subscriptionId: dbSubscription.subscription_id,
      currentPeriodStart: dbSubscription.current_period_start,
      currentPeriodEnd: dbSubscription.current_period_end,
      canceledAt: dbSubscription.canceled_at,
      endedAt: dbSubscription.ended_at,
      metadata: dbSubscription.metadata
        ? typeof dbSubscription.metadata === 'string'
          ? JSON.parse(dbSubscription.metadata)
          : dbSubscription.metadata
        : {},
      createdAt: dbSubscription.created_at,
      updatedAt: dbSubscription.updated_at,
    };
  }
}

export default SubscriptionService;
