/**
 * Schema application for the JS-driven SQLite engines (sql.js).
 *
 * In production the schema is created by the Rust migrations; in the browser dev
 * server (and Node tests) there is no Rust runtime, so we run the same canonical
 * SQL file here. The `?raw` import keeps `migrations/0001_init.sql` the single
 * source of truth shared with Rust (which embeds it via include_str!).
 */

import type { SqlDriver } from '../sql/SqlDriver';
// Browser/Vite raw import of the canonical schema file (see vite-env.d.ts).
import schemaSql from '../../../migrations/0001_init.sql?raw';

export const SCHEMA_SQL: string = schemaSql;

/** Create all tables/indexes on a fresh (sql.js) database. */
export async function applyMigrations(driver: SqlDriver): Promise<void> {
  await driver.execute(SCHEMA_SQL);
}
