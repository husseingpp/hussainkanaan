/**
 * Test-only helper: spin up an in-memory sql.js database with the real schema
 * applied, returning a `SqlJsDriver`. Lets the Node test suite exercise the exact
 * production repository code against a real SQLite engine.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { SqlJsDriver } from '../data/sqlite/SqlJsDriver';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

export async function createTestDriver(): Promise<SqlJsDriver> {
  const SQL = await initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
  });
  const db = new SQL.Database();
  const driver = new SqlJsDriver(db);

  const schemaSql = readFileSync(
    path.resolve(here, '../../migrations/0001_init.sql'),
    'utf8',
  );
  await driver.execute(schemaSql);

  return driver;
}
