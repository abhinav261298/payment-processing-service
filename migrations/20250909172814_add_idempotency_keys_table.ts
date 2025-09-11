import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('idempotency_keys', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('key').notNullable().unique();
    table.string('request_path').notNullable();
    table.jsonb('request_params').notNullable();
    table.jsonb('response').notNullable();
    table.integer('status_code').notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamps(true, true);
    
    // Index for faster lookups
    table.index(['key', 'request_path']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('idempotency_keys');
}
