import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

// Anon client — for user-scoped operations
export const supabase = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey,
);

// Service client — bypasses RLS, backend only
export const supabaseAdmin = createClient(
  config.supabaseUrl,
  config.supabaseServiceKey,
);