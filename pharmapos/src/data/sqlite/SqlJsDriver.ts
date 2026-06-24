/**
 * SqlDriver backed by sql.js (WASM SQLite). Used by Node tests and the browser
 * dev server — the exact same SQL as production, just an in-memory engine.
 *
 * The caller is responsible for creating the sql.js `Database` (init differs
 * between Node and the browser); this class only adapts it to `SqlDriver`.
 */

import type { SqlJsDatabase } from 'sql.js';
import type { SqlDriver, SqlParam } from '../sql/SqlDriver';

export class SqlJsDriver implements SqlDriver {
  constructor(private readonly db: SqlJsDatabase) {}

  async execute(sql: string, params: SqlParam[] = []): Promise<void> {
    // sql.js forbids multi-statement strings when params are supplied, so only
    // pass params when we actually have them (lets applyMigrations run the schema).
    if (params.length === 0) {
      this.db.run(sql);
    } else {
      this.db.run(sql, params);
    }
  }

  async select<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    try {
      if (params.length > 0) {
        stmt.bind(params);
      }
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }
}
