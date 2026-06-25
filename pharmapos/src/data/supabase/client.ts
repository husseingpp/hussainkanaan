/**
 * Supabase client for cloud mode. Configured from Vite env vars
 * (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Phase 3 is a permissive MVP — the
 * anon key is used directly (RLS is allow-all); a login screen + tight RLS come later.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** True when cloud config is present (used by createRepository to pick the backend). */
export function hasCloudConfig(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function createSupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
