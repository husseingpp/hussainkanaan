import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cookie-less anon client for public reads (RLS limits it to published data).
 * Works at build time (static export) and at request time (Cloudflare).
 * Returns null when Supabase isn't configured, so the site falls back to defaults.
 */
export function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type PublicClient = NonNullable<ReturnType<typeof getPublicClient>>;
