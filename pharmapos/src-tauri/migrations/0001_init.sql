-- 0001_init — initial PharmaPOS schema (Phase 1).
-- FORWARD-ONLY: never edit a shipped migration; add a new numbered file instead.
--
-- Sync columns present on every table from day one (sync engine lands in Phase 4):
--   id         TEXT  — client-generated UUIDv4
--   updated_at TEXT  — ISO-8601 UTC, set by the Rust core on every write
--   device_id  TEXT  — device that last wrote the row
--   dirty      INT   — 1 = local change not yet pushed to cloud; sync flips it to 0
--
-- Conventions: money is stored as INTEGER minor units of its currency
-- (USD → cents ×100, LBP → whole pounds ×1). Booleans are INTEGER 0/1.

CREATE TABLE pharmacies (
  id                   TEXT PRIMARY KEY NOT NULL,
  name                 TEXT NOT NULL,
  license_no           TEXT,
  phone                TEXT,
  address              TEXT,
  main_currency        TEXT NOT NULL DEFAULT 'USD' CHECK (main_currency IN ('USD','LBP')),
  fx_rate_lbp_per_usd  REAL,            -- LBP per 1 USD, used for display conversion
  fx_updated_at        TEXT,
  default_vat_rate     REAL NOT NULL DEFAULT 0.11,
  updated_at           TEXT NOT NULL,
  device_id            TEXT NOT NULL,
  dirty                INTEGER NOT NULL DEFAULT 1
);

-- Identity only this phase. PINs / passwords / auth arrive in a later phase.
CREATE TABLE users (
  id           TEXT PRIMARY KEY NOT NULL,
  pharmacy_id  TEXT REFERENCES pharmacies(id),
  full_name    TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'staff',
  active       INTEGER NOT NULL DEFAULT 1,
  updated_at   TEXT NOT NULL,
  device_id    TEXT NOT NULL,
  dirty        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE products (
  id            TEXT PRIMARY KEY NOT NULL,
  pharmacy_id   TEXT REFERENCES pharmacies(id),
  name          TEXT NOT NULL,
  generic_name  TEXT,
  barcode       TEXT,
  form          TEXT,                    -- tablet, capsule, syrup, cream, ...
  strength      TEXT,                    -- "500 mg", "10 mg/5 ml"
  category      TEXT,
  manufacturer  TEXT,
  requires_rx   INTEGER NOT NULL DEFAULT 0,
  controlled    INTEGER NOT NULL DEFAULT 0,
  vat_rate      REAL    NOT NULL DEFAULT 0.0,   -- form pre-fills from pharmacies.default_vat_rate
  updated_at    TEXT NOT NULL,
  device_id     TEXT NOT NULL,
  dirty         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_products_name    ON products(name);
CREATE INDEX idx_products_generic ON products(generic_name);
-- One barcode resolves to exactly one product per pharmacy. NULL/empty barcodes are exempt.
CREATE UNIQUE INDEX uq_products_barcode
  ON products(pharmacy_id, barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';

CREATE TABLE batches (
  id           TEXT PRIMARY KEY NOT NULL,
  product_id   TEXT NOT NULL REFERENCES products(id),  -- delete of a product with batches is blocked
  batch_no     TEXT,
  expiry_date  TEXT,                    -- 'YYYY-MM-DD'
  currency     TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','LBP')),
  cost_price   INTEGER NOT NULL DEFAULT 0,   -- minor units of `currency`
  sell_price   INTEGER NOT NULL DEFAULT 0,   -- minor units of `currency`
  qty_on_hand  INTEGER NOT NULL DEFAULT 0,   -- editable now; stock *movements* are a later phase
  supplier_id  TEXT,                    -- suppliers table is a later phase
  updated_at   TEXT NOT NULL,
  device_id    TEXT NOT NULL,
  dirty        INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_batches_product ON batches(product_id);
CREATE INDEX idx_batches_expiry  ON batches(expiry_date);
