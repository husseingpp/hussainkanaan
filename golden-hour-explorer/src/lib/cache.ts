/**
 * Offline-first cache. Screens hydrate instantly from SQLite, then reconcile
 * against Supabase. `dedupById` (a Set on ids) guarantees we never render the
 * same spot twice while cache + network results merge.
 */
import * as SQLite from "expo-sqlite";
import type { Spot } from "./types";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("golden-hour.db");
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS spots_cache (
           id TEXT PRIMARY KEY NOT NULL,
           json TEXT NOT NULL,
           cached_at INTEGER NOT NULL
         );`,
      );
      return db;
    })();
  }
  return dbPromise;
}

export function dedupById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export async function cacheSpots(spots: Spot[]): Promise<void> {
  try {
    const db = await getDb();
    const now = Date.now();
    await db.withTransactionAsync(async () => {
      for (const s of dedupById(spots)) {
        await db.runAsync(
          "INSERT OR REPLACE INTO spots_cache (id, json, cached_at) VALUES (?, ?, ?)",
          s.id,
          JSON.stringify(s),
          now,
        );
      }
    });
  } catch {
    // Cache is best-effort; never let a write failure break the UI.
  }
}

export async function getCachedSpots(): Promise<Spot[]> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ json: string }>(
      "SELECT json FROM spots_cache ORDER BY cached_at DESC",
    );
    const parsed = rows.map((r) => JSON.parse(r.json) as Spot);
    return dedupById(parsed);
  } catch {
    return [];
  }
}
