import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Public, read-only browser/server client. Uses the anon key, which is gated by
 * Row Level Security to SELECT-only on every table. Safe to use anywhere.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false },
  });
}

/**
 * Privileged client used ONLY by server-side ingestion jobs. Uses the
 * service-role key, which bypasses RLS. Throws if called where the key is not
 * available (e.g. the browser) so the secret can never leak client-side.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (typeof window !== "undefined") {
    throw new Error("createServiceClient must never run in the browser");
  }
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });
}
