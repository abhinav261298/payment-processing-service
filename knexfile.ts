import type { Knex } from 'knex';
import 'dotenv/config';

// Helper to parse SSL config from environment
const parseSSL = () => {
  if (process.env.DATABASE_SSL === 'true') {
    return {
      rejectUnauthorized: false,
    };
  }
  return undefined;
};

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: {
      connectionString:
        process.env.DATABASE_URL ||
        'postgres://postgres:postgres@localhost:5432/payment_processing',
      ssl: parseSSL(),
    },
    migrations: {
      directory: './migrations',
      extension: 'ts',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds',
      extension: 'ts',
    },
    debug: process.env.NODE_ENV === 'development' ? true : false,
  },
  staging: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: parseSSL(),
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
  },
  test: {
    client: 'pg',
    connection: {
      connectionString:
        process.env.TEST_DATABASE_URL ||
        'postgres://postgres@localhost:5432/payment_processing_test',
      ssl: parseSSL(),
    },
    migrations: {
      directory: './migrations',
      extension: 'ts',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds',
      extension: 'ts',
    },
    debug: false,
  },
  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: parseSSL(),
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
  },
};

export default config;
