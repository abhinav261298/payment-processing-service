import knex, { Knex } from 'knex';
import config from '../../knexfile';
import 'dotenv/config';

// Use the appropriate environment config
const environment = process.env.NODE_ENV || 'development';
const knexConfig = config[environment];

// Initialize Knex with the appropriate config
const db: Knex = knex(knexConfig);

// Test the database connection
const testConnection = async (): Promise<void> => {
  try {
    await db.raw('SELECT 1');
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (): Promise<void> => {
  try {
    await db.destroy();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
};

// Handle process termination
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { db, testConnection, shutdown };

export default db;
