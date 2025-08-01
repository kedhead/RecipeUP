import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Database connection configuration
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create postgres client with Supabase-friendly configuration
const client = postgres(connectionString, {
  max: 10, // Maximum number of connections
  idle_timeout: 20,
  connect_timeout: 10,
  // Supabase connection settings
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  // Connection pooling for Vercel edge functions
  prepare: false,
});

// Create Drizzle database instance
export const db = drizzle(client, { schema });

// Export schema for use in other files
export * from './schema';
export { schema };

// Database connection health check
export async function healthCheck(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeConnection(): Promise<void> {
  await client.end();
}