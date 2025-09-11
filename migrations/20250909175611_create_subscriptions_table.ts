import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('subscriptions');
  if (exists) return;

  await knex.schema.createTable('subscriptions', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Reference to the user who owns the subscription
    table.uuid('user_id').notNullable().references('id').inTable('users');
    
    // Subscription details
    table.string('name').notNullable();
    table.text('description').nullable();
    table.decimal('amount', 10, 2).notNullable();
    table.string('currency', 3).defaultTo('USD');
    
    // Billing cycle
    table.string('interval').notNullable(); // day, week, month, year
    table.integer('interval_count').notNullable().defaultTo(1);
    
    // Trial period
    table.boolean('has_trial').defaultTo(false);
    table.integer('trial_days').nullable();
    
    // Status
    table.enum('status', [
      'active',
      'canceled',
      'expired',
      'suspended',
      'pending',
      'past_due'
    ]).notNullable().defaultTo('pending');
    
    // Payment method
    table.string('payment_method_id').notNullable();
    
    // Authorize.Net specific fields
    table.string('subscription_id').nullable(); // Authorize.Net subscription ID
    
    // Dates
    table.timestamp('starts_at').notNullable();
    table.timestamp('current_period_start').nullable();
    table.timestamp('current_period_end').nullable();
    table.timestamp('canceled_at').nullable();
    table.timestamp('ended_at').nullable();
    
    // Metadata
    table.jsonb('metadata').nullable();
    
    // Timestamps
    table.timestamps(true, true);
    
    // Indexes
    table.index(['user_id']);
    table.index(['status']);
    table.index(['subscription_id']);
    table.index(['current_period_end']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('subscriptions');
}
