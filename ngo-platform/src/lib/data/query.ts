import "server-only";
import { unstable_cache } from "next/cache";
import { getPublicClient, type PublicClient } from "@/lib/supabase/public";
import type { CacheTag } from "@/lib/cache";

type Response = { data: unknown; error: { message: string } | null };

/**
 * Runs a public query, cached under `tags` so admin writes can revalidate it.
 * - Supabase not configured → `fallback` (lets the site build with defaults).
 * - Query error → throws, so a broken build never replaces a working site.
 */
export function publicQuery<R extends Response, A extends unknown[], F>(
  key: string,
  tags: CacheTag[],
  run: (db: PublicClient, ...args: A) => PromiseLike<R>,
  fallback: F,
) {
  type Data = NonNullable<R["data"]>;
  return unstable_cache(
    async (...args: A): Promise<Data | F> => {
      const db = getPublicClient();
      if (!db) return fallback;
      const { data, error } = await run(db, ...args);
      if (error) throw new Error(`[data:${key}] ${error.message}`);
      return (data ?? fallback) as Data | F;
    },
    [key],
    { tags },
  );
}
