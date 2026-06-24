/**
 * Minimal ambient types for sql.js — only the surface PharmaPOS uses.
 * (Avoids depending on @types/sql.js export-shape quirks.)
 */
declare module 'sql.js' {
  export interface SqlJsStatement {
    bind(params?: unknown[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): boolean;
  }

  export interface SqlJsDatabase {
    run(sql: string, params?: unknown[]): SqlJsDatabase;
    prepare(sql: string): SqlJsStatement;
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | null) => SqlJsDatabase;
  }

  export interface InitConfig {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: InitConfig): Promise<SqlJsStatic>;
}
