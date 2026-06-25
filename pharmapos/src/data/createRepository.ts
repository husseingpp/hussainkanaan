/**
 * Builds the Repository the UI uses, picking the backend for the runtime:
 *   - Tauri desktop          → TauriSqlDriver (persistent SQLite; schema via Rust migrations).
 *   - Web + Supabase env set  → SupabaseRepository (cloud mode, Phase 3).
 *   - Browser dev (no cloud)  → sql.js (WASM SQLite), schema applied here, then seeded.
 * Offline backends seed demo data on first run; cloud data is server-managed (seeded server-side).
 */

import type { Repository } from './repository';
import type { Session } from './seed';
import type { SqlDriver } from './sql/SqlDriver';
import { SqliteRepository } from './sqlite/SqliteRepository';

export interface RepositoryContext {
  repo: Repository;
  session: Session;
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function hasCloudConfig(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

async function makeSqlJsDriver(): Promise<SqlDriver> {
  const [sqlJs, driverMod, wasm] = await Promise.all([
    import('sql.js'),
    import('./sqlite/SqlJsDriver'),
    import('sql.js/dist/sql-wasm.wasm?url'),
  ]);
  const SQL = await sqlJs.default({ locateFile: () => wasm.default });
  return new driverMod.SqlJsDriver(new SQL.Database());
}

async function makeDriver(): Promise<SqlDriver> {
  if (isTauri()) {
    const { TauriSqlDriver } = await import('./sqlite/TauriSqlDriver');
    return TauriSqlDriver.open();
  }
  if (import.meta.env.DEV) {
    const driver = await makeSqlJsDriver();
    const { applyMigrations } = await import('./sqlite/schema');
    await applyMigrations(driver);
    return driver;
  }
  throw new Error('No backend configured: set Supabase env vars for cloud mode, or run on desktop.');
}

async function createCloudRepository(): Promise<RepositoryContext> {
  const [{ createSupabaseClient }, { SupabaseRepository }] = await Promise.all([
    import('./supabase/client'),
    import('./supabase/SupabaseRepository'),
  ]);
  const repo = new SupabaseRepository(createSupabaseClient());
  const branchId = await repo.settings.get('current_branch_id');
  const userId = await repo.settings.get('current_user_id');
  if (!branchId || !userId) {
    throw new Error('Cloud database is not seeded (missing current_branch_id/current_user_id).');
  }
  return { repo, session: { branchId, userId } };
}

export async function createRepository(): Promise<RepositoryContext> {
  // Cloud mode (web): use Supabase when configured. Tauri always stays offline-first.
  if (!isTauri() && hasCloudConfig()) {
    return createCloudRepository();
  }

  // Offline modes: SQLite via Tauri, or seeded sql.js in dev.
  const driver = await makeDriver();
  const repo = new SqliteRepository(driver);

  const products = await repo.products.list();
  let branchId = await repo.settings.get('current_branch_id');
  let userId = await repo.settings.get('current_user_id');

  if (products.length === 0 || !branchId || !userId) {
    const { seedDemoData } = await import('./seed');
    const session = await seedDemoData(driver);
    branchId = session.branchId;
    userId = session.userId;
  }

  return { repo, session: { branchId, userId } };
}
