/**
 * Production SqlDriver for the desktop app, backed by `tauri-plugin-sql`
 * (a single persistent SQLite file). The schema is created by the Rust
 * migrations in `src-tauri/src/lib.rs`, so this driver never runs DDL.
 */

import Database from '@tauri-apps/plugin-sql';
import type { SqlDriver, SqlParam } from '../sql/SqlDriver';

export class TauriSqlDriver implements SqlDriver {
  private constructor(private readonly db: Database) {}

  static async open(path = 'sqlite:pharmapos.db'): Promise<TauriSqlDriver> {
    const db = await Database.load(path);
    return new TauriSqlDriver(db);
  }

  async execute(sql: string, params: SqlParam[] = []): Promise<void> {
    await this.db.execute(sql, params);
  }

  async select<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    return this.db.select<T[]>(sql, params);
  }
}
