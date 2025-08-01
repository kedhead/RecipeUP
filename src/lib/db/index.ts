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
  max: 1, // Reduce connections for serverless
  idle_timeout: 20,
  connect_timeout: 30, // Increase timeout
  // Supabase connection settings
  ssl: 'require', // Always use SSL for Supabase
  // Connection pooling for Vercel edge functions
  prepare: false,
  // Additional Supabase-specific settings
  transform: postgres.camel,
});

// Create Drizzle database instance
export const db = drizzle(client, { schema });

// Export schema for use in other files
export * from './schema';
export { schema };

// Database connection health check
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await client`SELECT 1 as test`;
    console.log('Database health check successful:', result);
    return true;
  } catch (error) {
    console.error('Database health check failed. Details:', {
      error: error instanceof Error ? error.message : error,
      connectionString: connectionString?.substring(0, 30) + '...',
      hasConnectionString: !!connectionString,
      nodeEnv: process.env.NODE_ENV
    });
    return false;
  }
}

// Graceful shutdown
export async function closeConnection(): Promise<void> {
  await client.end();
}