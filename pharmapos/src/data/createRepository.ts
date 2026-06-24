/**
 * Builds the Repository the UI uses, picking the right SQL backend for the runtime:
 *   - Tauri desktop → TauriSqlDriver (persistent SQLite file; schema via Rust migrations).
 *   - Browser dev   → sql.js (WASM SQLite), schema applied here, then seeded.
 * The sql.js path is dev-only so production/desktop bundles don't ship it (web cloud
 * mode arrives in Phase 3). On an empty database we seed demo data so there's something
 * to ring up immediately.
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
  throw new Error('No SQL backend: desktop uses Tauri; web cloud mode arrives in Phase 3.');
}

export async function createRepository(): Promise<RepositoryContext> {
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
