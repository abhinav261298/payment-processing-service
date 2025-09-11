import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Enable UUID extension
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  // Create users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.string('email', 150).unique().notNullable();
    table.text('password_hash').notNullable();
    table.timestamps(true, true);
  });

  // Create transactions table
  await knex.schema.createTable('transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.decimal('amount', 12, 2).notNullable();
    table.string('currency', 10).defaultTo('USD');
    table.enum('status', ['PENDING', 'AUTHORIZED', 'CAPTURED', 'CANCELLED', 'REFUNDED', 'FAILED']).notNullable();
    table.string('authorize_net_transaction_id', 100);
    table.uuid('correlation_id').notNullable();
    table.timestamps(true, true);
  });

  // Create payment_logs table
  await knex.schema.createTable('payment_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('transaction_id').notNullable().references('id').inTable('transactions').onDelete('CASCADE');
    table.jsonb('gateway_response').notNullable();
    table.timestamps(false, true);
  });

  // Create subscriptions table
  await knex.schema.createTable('subscriptions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('plan_name', 50).notNullable();
    table.decimal('amount', 12, 2).notNullable();
    table.string('currency', 10).defaultTo('USD');
    table.enum('interval', ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).notNullable();
    table.enum('status', ['ACTIVE', 'CANCELLED', 'PAUSED']).notNullable();
    table.string('authorize_net_subscription_id', 100);
    table.timestamps(true, true);
  });

  // Create webhook_events table
  await knex.schema.createTable('webhook_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('event_type', 100).notNullable();
    table.jsonb('payload').notNullable();
    table.boolean('processed').defaultTo(false);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('webhook_events');
  await knex.schema.dropTableIfExists('payment_logs');
  await knex.schema.dropTableIfExists('subscriptions');
  await knex.schema.dropTableIfExists('transactions');
  await knex.schema.dropTableIfExists('users');
  await knex.raw('DROP EXTENSION IF EXISTS "pgcrypto"');
  await knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp"');
}
