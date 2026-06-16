-- 0002_sales — Phase 2: sales / POS flow.
-- FORWARD-ONLY: never edit a shipped migration; add a new numbered file instead.
-- Money is INTEGER minor units of the row's currency (see CLAUDE.md).

CREATE TABLE sales (
  id                   TEXT PRIMARY KEY NOT NULL,
  pharmacy_id          TEXT REFERENCES pharmacies(id),
  user_id              TEXT REFERENCES users(id),     -- nullable until auth lands
  sale_no              INTEGER NOT NULL,              -- sequential receipt # per pharmacy
  currency             TEXT NOT NULL CHECK (currency IN ('USD','LBP')),  -- settlement currency
  fx_rate_lbp_per_usd  REAL,                          -- rate snapshot used at checkout
  subtotal             INTEGER NOT NULL DEFAULT 0,    -- pre-VAT, minor units of `currency`
  vat_total            INTEGER NOT NULL DEFAULT 0,
  discount_total       INTEGER NOT NULL DEFAULT 0,
  grand_total          INTEGER NOT NULL DEFAULT 0,
  payment_method       TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','card','other')),
  amount_tendered      INTEGER NOT NULL DEFAULT 0,
  change_due           INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','void')),
  note                 TEXT,
  sold_at              TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  device_id            TEXT NOT NULL,
  dirty                INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_sales_sold_at ON sales(sold_at);
CREATE UNIQUE INDEX uq_sales_no ON sales(pharmacy_id, sale_no);

CREATE TABLE sale_items (
  id            TEXT PRIMARY KEY NOT NULL,
  sale_id       TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id    TEXT REFERENCES products(id),   -- kept for reporting; may be null if product later removed
  batch_id      TEXT REFERENCES batches(id),
  product_name  TEXT NOT NULL,                  -- snapshot at time of sale
  batch_no      TEXT,                           -- snapshot
  qty           INTEGER NOT NULL,
  unit_price    INTEGER NOT NULL,               -- minor units of the sale currency (converted)
  vat_rate      REAL    NOT NULL DEFAULT 0,     -- snapshot
  line_vat      INTEGER NOT NULL DEFAULT 0,
  line_total    INTEGER NOT NULL DEFAULT 0,     -- incl. VAT, minor units of sale currency
  updated_at    TEXT NOT NULL,
  device_id     TEXT NOT NULL,
  dirty         INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- Stock ledger. Phase 3 purchases/adjustments reuse this table (qty_delta > 0).
CREATE TABLE inventory_movements (
  id          TEXT PRIMARY KEY NOT NULL,
  product_id  TEXT REFERENCES products(id),
  batch_id    TEXT REFERENCES batches(id),
  qty_delta   INTEGER NOT NULL,                 -- negative = stock out (a sale)
  reason      TEXT NOT NULL,                    -- 'sale' | 'adjustment' (purchases later)
  ref_type    TEXT,                             -- e.g. 'sale'
  ref_id      TEXT,                             -- e.g. the sale id
  moved_at    TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  device_id   TEXT NOT NULL,
  dirty       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_inv_mov_batch ON inventory_movements(batch_id);
CREATE INDEX idx_inv_mov_ref ON inventory_movements(ref_type, ref_id);
