import { Knex } from 'knex';

declare module 'knex/types/tables' {
  interface Tables {
    users: User;
    users_composite: Knex.CompositeTableType<
      User,
      Omit<User, 'id' | 'created_at' | 'updated_at'>,
      Partial<Omit<User, 'id' | 'created_at'>>
    >;

    transactions: Transaction;
    transactions_composite: Knex.CompositeTableType<
      Transaction,
      Omit<Transaction, 'id' | 'created_at' | 'updated_at'>,
      Partial<Omit<Transaction, 'id' | 'created_at'>>
    >;

    payment_logs: PaymentLog;
    payment_logs_composite: Knex.CompositeTableType<
      PaymentLog,
      Omit<PaymentLog, 'id' | 'created_at'>,
      Partial<Omit<PaymentLog, 'id' | 'created_at'>>
    >;

    subscriptions: Subscription;
    subscriptions_composite: Knex.CompositeTableType<
      Subscription,
      Omit<Subscription, 'id' | 'created_at' | 'updated_at'>,
      Partial<Omit<Subscription, 'id' | 'created_at'>>
    >;

    webhook_events: WebhookEvent;
    webhook_events_composite: Knex.CompositeTableType<
      WebhookEvent,
      Omit<WebhookEvent, 'id' | 'created_at' | 'updated_at'>,
      Partial<Omit<WebhookEvent, 'id' | 'created_at'>>
    >;
  }
}

export interface BaseModel {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface User extends BaseModel {
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  role: string;
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DECLINED = 'declined',
  REFUNDED = 'refunded',
  VOIDED = 'voided',
}

export interface Transaction extends BaseModel {
  user_id: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  authorize_net_transaction_id: string | null;
  correlation_id: string;
  metadata?: Record<string, any>;
}

export interface PaymentLog extends Omit<BaseModel, 'updated_at'> {
  transaction_id: string;
  action: string;
  gateway_response: Record<string, any>;
}

export enum SubscriptionInterval {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
  PAST_DUE = 'past_due',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

export interface Subscription extends BaseModel {
  user_id: string;
  plan_name: string;
  amount: number;
  currency: string;
  interval: SubscriptionInterval;
  status: SubscriptionStatus;
  authorize_net_subscription_id: string | null;
}

export interface WebhookEvent extends BaseModel {
  event_id: string;
  event_type: string;
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  entity_type?: string | null;
  entity_id?: string | null;
  processed_at?: Date | null;
  error_message?: string | null;
  error_stack?: string | null;
  retry_count: number;
  metadata?: Record<string, any>;
}

// Type helpers for Knex queries
export type CreateUser = Omit<User, 'id' | 'created_at' | 'updated_at'>;
export type UpdateUser = Partial<Omit<User, 'id' | 'created_at'>>;

export type CreateTransaction = Omit<Transaction, 'id' | 'created_at' | 'updated_at'>;
export type UpdateTransaction = Partial<Omit<Transaction, 'id' | 'created_at'>>;

export type CreatePaymentLog = Omit<PaymentLog, 'id' | 'created_at'>;

export type CreateSubscription = Omit<Subscription, 'id' | 'created_at' | 'updated_at'>;
export type UpdateSubscription = Partial<Omit<Subscription, 'id' | 'created_at'>>;

export type CreateWebhookEvent = Omit<WebhookEvent, 'id' | 'created_at' | 'updated_at'>;
export type UpdateWebhookEvent = Partial<Omit<WebhookEvent, 'id' | 'created_at'>>;
