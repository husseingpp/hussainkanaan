/**
 * Domain types — mirror BLUEPRINT.md §6. The same shape is used in SQLite (desktop)
 * and Postgres (Supabase). The UI only ever sees these types, never a raw DB row.
 *
 * Money rules (CLAUDE.md):
 *   - All money fields are integer minor units. USD = cents, LBP = whole LL.
 *   - Canonical price currency is USD cents (`*_usd_cents`).
 */

export type UUID = string;
/** ISO 8601 timestamp, e.g. "2026-06-24T10:00:00.000Z". */
export type IsoTimestamp = string;
/** Calendar date, e.g. "2027-03-01". */
export type IsoDate = string;

export type Role = 'admin' | 'pharmacist' | 'cashier';
export type SaleStatus = 'completed' | 'held' | 'voided' | 'refunded';
export type PaymentCurrency = 'USD' | 'LBP';
export type PaymentMethod = 'cash' | 'card' | 'credit';
export type StockMovementType = 'sale' | 'purchase' | 'adjustment' | 'return';

/**
 * Sync metadata carried by every syncable row (BLUEPRINT.md §6/§7):
 *  - `id` is a client-generated UUID so offline rows have stable IDs.
 *  - `deleted_at` is a soft-delete tombstone.
 *  - `updated_at` (LWW) + `sync_version` drive conflict resolution.
 */
export interface SyncMeta {
  id: UUID;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  deleted_at: IsoTimestamp | null;
  last_modified_by: UUID | null;
  sync_version: number;
}

export interface Branch extends SyncMeta {
  name: string;
  address: string | null;
  phone: string | null;
}

export interface User extends SyncMeta {
  branch_id: UUID;
  name: string;
  role: Role;
  pin_hash: string | null;
  supabase_user_id: UUID | null;
  active: boolean;
}

export interface Category extends SyncMeta {
  name: string;
}

export interface Supplier extends SyncMeta {
  name: string;
  phone: string | null;
  notes: string | null;
}

export interface Product extends SyncMeta {
  sku: string | null;
  barcode: string | null;
  name: string;
  generic_name: string | null;
  brand: string | null;
  form: string | null; // tablet, syrup, ...
  strength: string | null; // e.g. "500mg"
  category_id: UUID | null;
  supplier_id: UUID | null;
  price_usd_cents: number; // canonical price
  cost_usd_cents: number; // for profit reports
  vat_rate: number; // e.g. 0.11 for 11%
  is_controlled: boolean;
  active: boolean;
}

/** Stock lives on batches so we can do FEFO and near-expiry alerts. */
export interface Batch extends SyncMeta {
  product_id: UUID;
  branch_id: UUID;
  batch_no: string | null;
  expiry_date: IsoDate | null;
  qty_on_hand: number; // DERIVED CACHE — truth is stock_movements (CLAUDE.md)
  cost_usd_cents: number;
}

export interface Customer extends SyncMeta {
  name: string;
  phone: string | null;
  store_credit_usd_cents: number;
}

export interface ExchangeRate extends SyncMeta {
  usd_to_lbp: number; // whole LBP per 1 USD (integer)
  effective_from: IsoTimestamp;
  created_by: UUID | null;
}

export interface Sale extends SyncMeta {
  branch_id: UUID;
  user_id: UUID;
  customer_id: UUID | null;
  status: SaleStatus;
  subtotal_usd_cents: number;
  discount_usd_cents: number;
  vat_usd_cents: number;
  total_usd_cents: number;
  exchange_rate: number; // rate snapshot at sale time (BLUEPRINT.md §5)
  ll_rounding_cents: number; // applied LL rounding, expressed in USD cents
  prescription_ref: string | null;
}

export interface SaleLine extends SyncMeta {
  sale_id: UUID;
  product_id: UUID;
  batch_id: UUID;
  qty: number;
  unit_price_usd_cents: number;
  line_discount_usd_cents: number;
  line_total_usd_cents: number;
}

export interface Payment extends SyncMeta {
  sale_id: UUID;
  currency: PaymentCurrency;
  amount_minor: number; // minor units of `currency`
  method: PaymentMethod;
}

export interface StockMovement extends SyncMeta {
  product_id: UUID;
  batch_id: UUID;
  branch_id: UUID;
  type: StockMovementType;
  qty_delta: number; // negative for sales, positive for purchases/returns
  ref_id: UUID | null; // e.g. the sale id
}

export interface Setting {
  key: string;
  value: string;
}
