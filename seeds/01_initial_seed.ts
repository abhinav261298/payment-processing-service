import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { TransactionStatus, SubscriptionStatus, SubscriptionInterval } from '../src/types/database';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex('payment_logs').del();
  await knex('subscriptions').del();
  await knex('transactions').del();
  await knex('webhook_events').del();
  await knex('users').del();

  // Insert test users
  const [testUser1, testUser2] = await knex('users')
    .insert([
      {
        id: uuidv4(),
        first_name: 'Test',
        last_name: 'User 1',
        email: 'test1@example.com',
        password_hash: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: password
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        first_name: 'Test',
        last_name: 'User 2',
        email: 'test2@example.com',
        password_hash: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: password
        role: 'admin',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ])
    .returning('*');

  // Insert test transactions
  const [transaction1, transaction2] = await knex('transactions')
    .insert([
      {
        id: uuidv4(),
        user_id: testUser1.id,
        amount: '99.99',
        currency: 'USD',
        status: TransactionStatus.COMPLETED,
        authorize_net_transaction_id: 'A123456789',
        correlation_id: uuidv4(),
      },
      {
        id: uuidv4(),
        user_id: testUser2.id,
        amount: '49.99',
        currency: 'USD',
        status: TransactionStatus.PENDING,
        authorize_net_transaction_id: 'B987654321',
        correlation_id: uuidv4(),
      },
    ])
    .returning('*');

  // Insert test subscriptions
  const [subscription1, subscription2] = await knex('subscriptions')
    .insert([
      {
        id: uuidv4(),
        user_id: testUser1.id,
        plan_name: 'Premium',
        amount: 29.99,
        currency: 'USD',
        interval: SubscriptionInterval.MONTH,
        status: SubscriptionStatus.ACTIVE,
        authorize_net_subscription_id: 'sub_123456789',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        user_id: testUser2.id,
        plan_name: 'Enterprise',
        amount: 99.99,
        currency: 'USD',
        interval: SubscriptionInterval.YEAR,
        status: SubscriptionStatus.ACTIVE,
        authorize_net_subscription_id: 'sub_987654321',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ])
    .returning('*');

  // Insert test payment logs
  await knex('payment_logs').insert([
    {
      id: uuidv4(),
      transaction_id: transaction1.id,
      gateway_response: {
        transactionId: transaction1.authorize_net_transaction_id,
        responseCode: '1',
        message: 'This transaction has been approved.',
        transactionStatus: 'settledSuccessfully',
      },
    },
    {
      id: uuidv4(),
      transaction_id: transaction2.id,
      gateway_response: {
        transactionId: transaction2.authorize_net_transaction_id,
        responseCode: '4',
        message: 'The transaction is currently being held for review.',
        transactionStatus: 'pendingReview',
      },
    },
  ]);

  // Insert test webhook events with correct schema
  const evt1Id = `evt_${uuidv4()}`;
  const evt2Id = `evt_${uuidv4()}`;

  await knex('webhook_events').insert([
    {
      id: uuidv4(),
      event_id: evt1Id,
      event_type: 'payment.captured',
      payload: {
        id: evt1Id,
        type: 'payment.captured',
        data: {
          object: {
            id: transaction1.id,
            amount: transaction1.amount,
            currency: transaction1.currency,
          },
        },
      },
      status: 'processed',
      retry_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
      processed_at: new Date(),
      error_message: null,
      error_stack: null,
      entity_type: 'transaction',
      entity_id: transaction1.id,
      metadata: {},
    },
    {
      id: uuidv4(),
      event_id: evt2Id,
      event_type: 'payment.pending',
      payload: {
        id: evt2Id,
        type: 'payment.pending',
        data: {
          object: {
            id: transaction2.id,
            amount: transaction2.amount,
            currency: transaction2.currency,
          },
        },
      },
      status: 'pending',
      retry_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
      processed_at: null,
      error_message: null,
      error_stack: null,
      entity_type: 'transaction',
      entity_id: transaction2.id,
      metadata: {},
    },
  ]);
}
