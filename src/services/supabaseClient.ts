/**
 * Supabase Client Configuration
 * Provides both authenticated and anonymous access clients for database operations
 * 
 * Security Notes:
 * - Service Role Key: Use ONLY for server-side operations (workers, backend APIs)
 *   NEVER expose this key to the client
 * - Anon Key: Use for client-side operations with Row Level Security (RLS)
 */

import { createClient } from '@supabase/supabase-js';
import config from '@/config';

/**
 * Service Role Client
 * Used for server-side operations (workers, background jobs, admin endpoints)
 * Has full access to the database - bypasses Row Level Security
 * CRITICAL: Keep this key secure, never expose to client
 */
export const supabaseServiceClient = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      persistSession: false,
    },
  }
);

/**
 * Anonymous Public Client
 * Used for client-side operations and public APIs
 * Respects Row Level Security (RLS) policies - only access data allowed by RLS
 */
export const supabaseAnonClient = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      persistSession: false,
    },
  }
);

/**
 * Database reference using service role (for backend operations)
 * Use this for accessing database tables from workers/backend services
 * Example: db('sellers').select()
 */
export const db = supabaseServiceClient.from;

export default {
  service: supabaseServiceClient,
  anon: supabaseAnonClient,
  db,
};
