/**
 * The thin SQL boundary every repository depends on.
 *
 * The same SQL runs against three engines via different drivers:
 *   - TauriSqlDriver  → tauri-plugin-sql (persistent SQLite file) — production desktop.
 *   - SqlJsDriver     → sql.js (WASM SQLite)                       — Node tests + browser dev.
 * Repositories never import a concrete engine; they take a `SqlDriver`.
 */

/** Values bindable to a parameterised query (`?` placeholders). */
export type SqlParam = string | number | null;

export interface SqlDriver {
  /** Run a statement that returns no rows (INSERT/UPDATE/DELETE/DDL). */
  execute(sql: string, params?: SqlParam[]): Promise<void>;
  /** Run a query and return its rows as objects keyed by column name. */
  select<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>;
}

/**
 * Run `fn` inside a single transaction (BEGIN / COMMIT, ROLLBACK on throw).
 *
 * NOTE: this issues BEGIN/COMMIT as separate statements through the driver. With
 * tauri-plugin-sql (an sqlx pool) that is reliable for a single-user desktop POS, but
 * revisit if the pool is ever configured with more than one connection.
 */
export async function withTransaction(driver: SqlDriver, fn: () => Promise<void>): Promise<void> {
  await driver.execute('BEGIN');
  try {
    await fn();
    await driver.execute('COMMIT');
  } catch (err) {
    try {
      await driver.execute('ROLLBACK');
    } catch {
      // Ignore rollback failures; surface the original error.
    }
    throw err;
  }
}
