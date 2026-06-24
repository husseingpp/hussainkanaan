-- PharmaPOS — initial schema (Phase 1)
-- Canonical SQLite schema. This exact file is used in two places:
--   * Rust desktop build: embedded via include_str! and run by tauri-plugin-sql.
--   * JS (sql.js): applied by applyMigrations() for Node tests and the browser dev server.
-- Conventions (CLAUDE.md / BLUEPRINT.md §6):
--   * Money is integer minor units. USD = *_usd_cents. Canonical price currency = USD cents.
--   * Booleans are stored as INTEGER 0/1. Timestamps/dates are ISO-8601 TEXT.
--   * Syncable rows carry: id (client UUID PK), created_at, updated_at, deleted_at (soft
--     delete), last_modified_by, sync_version.
-- Foreign keys are declared for documentation; enforcement (PRAGMA foreign_keys) is left off
-- so write order is flexible and offline inserts never trip referential checks.

CREATE TABLE IF NOT EXISTS branches (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  address          TEXT,
  phone            TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT,
  last_modified_by TEXT,
  sync_version     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT,
  last_modified_by TEXT,
  sync_version     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS suppliers (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  phone            TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT,
  last_modified_by TEXT,
  sync_version     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  branch_id         TEXT REFERENCES branches(id),
  name              TEXT NOT NULL,
  role              TEXT NOT NULL CHECK (role IN ('admin', 'pharmacist', 'cashier')),
  pin_hash          TEXT,
  supabase_user_id  TEXT,
  active            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  deleted_at        TEXT,
  last_modified_by  TEXT,
  sync_version      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id               TEXT PRIMARY KEY,
  sku              TEXT,
  barcode          TEXT,
  name             TEXT NOT NULL,
  generic_name     TEXT,
  brand            TEXT,
  form             TEXT,
  strength         TEXT,
  category_id      TEXT REFERENCES categories(id),
  supplier_id      TEXT REFERENCES suppliers(id),
  price_usd_cents  INTEGER NOT NULL DEFAULT 0,   -- canonical price (VAT-inclusive)
  cost_usd_cents   INTEGER NOT NULL DEFAULT 0,   -- for profit reports
  vat_rate         REAL NOT NULL DEFAULT 0,      -- e.g. 0.11 for 11%
  is_controlled    INTEGER NOT NULL DEFAULT 0,
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT,
  last_modified_by TEXT,
  sync_version     INTEGER NOT NULL DEFAULT 0
);

-- Stock lives on batches (FEFO + near-expiry alerts). qty_on_hand is a DERIVED CACHE;
-- the truth is stock_movements (CLAUDE.md).
CREATE TABLE IF NOT EXISTS batches (
  id               TEXT PRIMARY KEY,
  product_id       TEXT NOT NULL REFERENCES products(id),
  branch_id        TEXT NOT NULL REFERENCES branches(id),
  batch_no         TEXT,
  expiry_date      TEXT,
  qty_on_hand      INTEGER NOT NULL DEFAULT 0,
  cost_usd_cents   INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT,
  last_modified_by TEXT,
  sync_version     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  phone                  TEXT,
  store_credit_usd_cents INTEGER NOT NULL DEFAULT 0,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  deleted_at             TEXT,
  last_modified_by       TEXT,
  sync_version           INTEGER NOT NULL DEFAULT 0
);

-- Exchange-rate history; never overwrite. usd_to_lbp = whole LBP per 1 USD.
CREATE TABLE IF NOT EXISTS exchange_rates (
  id               TEXT PRIMARY KEY,
  usd_to_lbp       INTEGER NOT NULL,
  effective_from   TEXT NOT NULL,
  created_by       TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT,
  last_modified_by TEXT,
  sync_version     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sales (
  id                 TEXT PRIMARY KEY,
  branch_id          TEXT NOT NULL REFERENCES branches(id),
  user_id            TEXT NOT NULL REFERENCES users(id),
  customer_id        TEXT REFERENCES customers(id),
  status             TEXT NOT NULL CHECK (status IN ('completed', 'held', 'voided', 'refunded')),
  subtotal_usd_cents INTEGER NOT NULL DEFAULT 0,
  discount_usd_cents INTEGER NOT NULL DEFAULT 0,
  vat_usd_cents      INTEGER NOT NULL DEFAULT 0,   -- VAT component of the (inclusive) total
  total_usd_cents    INTEGER NOT NULL DEFAULT 0,
  exchange_rate      INTEGER NOT NULL,             -- rate snapshot at sale time
  ll_rounding_cents  INTEGER NOT NULL DEFAULT 0,   -- applied LL rounding, in USD cents
  prescription_ref   TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  deleted_at         TEXT,
  last_modified_by   TEXT,
  sync_version       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sale_lines (
  id                      TEXT PRIMARY KEY,
  sale_id                 TEXT NOT NULL REFERENCES sales(id),
  product_id              TEXT NOT NULL REFERENCES products(id),
  batch_id                TEXT REFERENCES batches(id),
  qty                     INTEGER NOT NULL,
  unit_price_usd_cents    INTEGER NOT NULL,
  line_discount_usd_cents INTEGER NOT NULL DEFAULT 0,
  line_total_usd_cents    INTEGER NOT NULL,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  deleted_at              TEXT,
  last_modified_by        TEXT,
  sync_version            INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id               TEXT PRIMARY KEY,
  sale_id          TEXT NOT NULL REFERENCES sales(id),
  currency         TEXT NOT NULL CHECK (currency IN ('USD', 'LBP')),
  amount_minor     INTEGER NOT NULL,             -- minor units of `currency`
  method           TEXT NOT NULL CHECK (method IN ('cash', 'card', 'credit')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT,
  last_modified_by TEXT,
  sync_version     INTEGER NOT NULL DEFAULT 0
);

-- The source of truth for stock. qty_on_hand on batches is derived from these.
CREATE TABLE IF NOT EXISTS stock_movements (
  id               TEXT PRIMARY KEY,
  product_id       TEXT NOT NULL REFERENCES products(id),
  batch_id         TEXT REFERENCES batches(id),
  branch_id        TEXT NOT NULL REFERENCES branches(id),
  type             TEXT NOT NULL CHECK (type IN ('sale', 'purchase', 'adjustment', 'return')),
  qty_delta        INTEGER NOT NULL,             -- negative for sales
  ref_id           TEXT,                         -- e.g. the sale id
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT,
  last_modified_by TEXT,
  sync_version     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_barcode      ON products (barcode);
CREATE INDEX IF NOT EXISTS idx_products_name         ON products (name);
CREATE INDEX IF NOT EXISTS idx_batches_product       ON batches (product_id);
CREATE INDEX IF NOT EXISTS idx_sale_lines_sale       ON sale_lines (sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale         ON payments (sale_id);
CREATE INDEX IF NOT EXISTS idx_movements_product     ON stock_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_movements_batch       ON stock_movements (batch_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at      ON sales (created_at);
CREATE INDEX IF NOT EXISTS idx_sales_branch          ON sales (branch_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_eff    ON exchange_rates (effective_from);
