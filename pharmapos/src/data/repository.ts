/**
 * The data-access contract.
 *
 * The shared React UI talks ONLY to this interface — never to SQLite or Supabase
 * directly (CLAUDE.md). The desktop build wires it to a SQLite + sync-engine
 * implementation; the cloud build wires it to Supabase. Phase 0 ships the
 * interface plus two stub implementations; Phase 1/3 fill the bodies in.
 */

import type {
  Batch,
  ExchangeRate,
  Product,
  Sale,
  SaleStatus,
  Setting,
  PaymentCurrency,
  PaymentMethod,
  UUID,
} from './types';

/** Raised by stub implementations and any not-yet-implemented method. */
export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method} is not implemented yet`);
    this.name = 'NotImplementedError';
  }
}

// --- Inputs for creating a sale (the only "write" that spans several tables) ---

export interface NewSaleLineInput {
  product_id: UUID;
  batch_id: UUID;
  qty: number;
  unit_price_usd_cents: number; // VAT-inclusive unit price
  line_discount_usd_cents: number;
  vat_rate: number; // product VAT rate at sale time (e.g. 0.11), for the VAT line
}

export interface NewPaymentInput {
  currency: PaymentCurrency;
  amount_minor: number;
  method: PaymentMethod;
}

/**
 * Everything needed to ring up one completed sale. The repository is responsible
 * for atomically writing the sale + sale_lines + payments + stock_movements and
 * for snapshotting the exchange rate. Sales are immutable once completed.
 */
export interface NewSaleInput {
  branch_id: UUID;
  user_id: UUID;
  customer_id: UUID | null;
  lines: NewSaleLineInput[];
  payments: NewPaymentInput[];
  discount_usd_cents: number; // whole-sale discount
  exchange_rate: number; // rate to snapshot on the sale
  ll_rounding_cents: number; // applied LL rounding, in USD cents
  prescription_ref: string | null;
}

export interface SaleQuery {
  branch_id?: UUID;
  status?: SaleStatus;
  /** Inclusive lower bound on created_at (ISO timestamp). */
  from?: string;
  /** Exclusive upper bound on created_at (ISO timestamp). */
  to?: string;
}

export interface ProductRepository {
  list(): Promise<Product[]>;
  get(id: UUID): Promise<Product | null>;
  /** Free-text / barcode search used by the checkout screen. */
  search(query: string): Promise<Product[]>;
  /** Insert or update by id (LWW is fine for products — CLAUDE.md). */
  upsert(product: Product): Promise<Product>;
  /** Soft delete (sets deleted_at). */
  softDelete(id: UUID): Promise<void>;
}

export interface BatchRepository {
  listByProduct(productId: UUID): Promise<Batch[]>;
  get(id: UUID): Promise<Batch | null>;
  upsert(batch: Batch): Promise<Batch>;
}

export interface SaleRepository {
  /** Ring up an immutable completed sale (writes sale + lines + payments + movements). */
  createCompleted(input: NewSaleInput): Promise<Sale>;
  get(id: UUID): Promise<Sale | null>;
  list(query?: SaleQuery): Promise<Sale[]>;
}

export interface ExchangeRateRepository {
  /** The most recent rate (by effective_from), or null if none set. */
  current(): Promise<ExchangeRate | null>;
  history(): Promise<ExchangeRate[]>;
  set(usdToLbp: number, createdBy: UUID | null): Promise<ExchangeRate>;
}

export interface SettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  all(): Promise<Setting[]>;
}

// --- Inventory (Phase 2) ---

export interface ReceiveStockInput {
  product_id: UUID;
  branch_id: UUID;
  batch_no: string | null;
  expiry_date: string | null; // ISO date
  qty: number;
  cost_usd_cents: number;
  user_id: UUID | null;
}

export interface LowStockRow {
  product: Product;
  on_hand: number;
}

export type ExpiryBucket = 'expired' | 'expiring' | 'ok';

export interface ExpiryRow {
  batch: Batch;
  product: Product;
  bucket: ExpiryBucket;
  /** Whole days until expiry (negative = already expired); null when no expiry date. */
  days_to_expiry: number | null;
}

export interface InventoryRepository {
  /** Goods received: add stock to a new or existing batch + a `purchase` movement. */
  receiveStock(input: ReceiveStockInput): Promise<Batch>;
  /** Manual stock correction (damage, recount): an `adjustment` movement + cache update. */
  adjustStock(batchId: UUID, qtyDelta: number, userId: UUID | null): Promise<void>;
  /** Products whose total on-hand is below `threshold`. */
  lowStock(threshold: number): Promise<LowStockRow[]>;
  /** Batches with stock, bucketed by expiry as of `asOfIso`; `nearDays` defines "expiring". */
  expiryReport(asOfIso: string, nearDays: number): Promise<ExpiryRow[]>;
}

/** The single object the UI depends on. */
export interface Repository {
  products: ProductRepository;
  batches: BatchRepository;
  sales: SaleRepository;
  exchangeRates: ExchangeRateRepository;
  settings: SettingsRepository;
  inventory: InventoryRepository;
}
