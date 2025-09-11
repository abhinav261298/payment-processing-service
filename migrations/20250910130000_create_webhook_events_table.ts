import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('webhook_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('event_id').notNullable().unique();
    table.string('event_type').notNullable().index();
    table.jsonb('payload').notNullable();
    
    // Status fields
    table.enum('status', ['pending', 'processing', 'processed', 'failed']).notNullable().defaultTo('pending');
    
    // Entity reference fields
    table.string('entity_type').nullable();
    table.string('entity_id').nullable();
    
    // Timestamps
    table.timestamp('processed_at').nullable();
    table.timestamps(true, true);
    
    // Error tracking
    table.text('error_message').nullable();
    table.text('error_stack').nullable();
    
    // Retry tracking
    table.integer('retry_count').notNullable().defaultTo(0);
    
    // Additional metadata
    table.jsonb('metadata').notNullable().defaultTo('{}');
  });

  // Add index for common queries
  await knex.schema.alterTable('webhook_events', (table) => {
    table.index(['event_type', 'status']);
    table.index(['entity_type', 'entity_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('webhook_events');
}

// Add this migration to the exports
export const _meta = {
  version: 2, // Incremented version for the schema update
};

// This ensures TypeScript treats this as a module
export default { up, down, _meta };
