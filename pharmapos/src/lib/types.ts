// TypeScript mirrors of the Rust models (snake_case end-to-end — see CLAUDE.md).

export type Currency = "USD" | "LBP";

export interface Pharmacy {
  id: string;
  name: string;
  license_no: string | null;
  phone: string | null;
  address: string | null;
  main_currency: Currency;
  fx_rate_lbp_per_usd: number | null;
  fx_updated_at: string | null;
  default_vat_rate: number;
  updated_at: string;
  device_id: string;
  dirty: boolean;
}

export interface Product {
  id: string;
  pharmacy_id: string | null;
  name: string;
  generic_name: string | null;
  barcode: string | null;
  form: string | null;
  strength: string | null;
  category: string | null;
  manufacturer: string | null;
  requires_rx: boolean;
  controlled: boolean;
  vat_rate: number; // stored as a fraction, e.g. 0.11
  updated_at: string;
  device_id: string;
  dirty: boolean;
}

export interface ProductInput {
  name: string;
  generic_name: string | null;
  barcode: string | null;
  form: string | null;
  strength: string | null;
  category: string | null;
  manufacturer: string | null;
  requires_rx: boolean;
  controlled: boolean;
  vat_rate: number;
}

export interface Batch {
  id: string;
  product_id: string;
  batch_no: string | null;
  expiry_date: string | null; // 'YYYY-MM-DD'
  currency: Currency;
  cost_price: number; // INTEGER minor units of `currency`
  sell_price: number; // INTEGER minor units of `currency`
  qty_on_hand: number;
  supplier_id: string | null;
  updated_at: string;
  device_id: string;
  dirty: boolean;
}

export interface BatchInput {
  product_id: string;
  batch_no: string | null;
  expiry_date: string | null;
  currency: Currency;
  cost_price: number;
  sell_price: number;
  qty_on_hand: number;
  supplier_id: string | null;
}

// ---- Phase 2: sales / POS ----

export type PaymentMethod = "cash" | "card" | "other";

export interface Sale {
  id: string;
  pharmacy_id: string | null;
  user_id: string | null;
  sale_no: number;
  currency: Currency;
  fx_rate_lbp_per_usd: number | null;
  subtotal: number; // minor units of `currency`
  vat_total: number;
  discount_total: number;
  grand_total: number;
  payment_method: PaymentMethod;
  amount_tendered: number;
  change_due: number;
  status: string;
  note: string | null;
  sold_at: string;
  updated_at: string;
  device_id: string;
  dirty: boolean;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  batch_id: string | null;
  product_name: string;
  batch_no: string | null;
  qty: number;
  unit_price: number; // minor units of sale currency
  vat_rate: number;
  line_vat: number;
  line_total: number;
  updated_at: string;
  device_id: string;
  dirty: boolean;
}

export type SaleWithItems = Sale & { items: SaleItem[] };

export interface SellInfo {
  product_id: string;
  name: string;
  vat_rate: number;
  requires_rx: boolean;
  controlled: boolean;
  total_qty: number;
  best_currency: Currency | null;
  best_sell_price: number | null; // minor units of best_currency
}

export interface CartLineInput {
  product_id: string;
  qty: number;
}

export interface CheckoutInput {
  currency: Currency;
  payment_method: PaymentMethod;
  amount_tendered: number; // minor units of settlement currency
  note: string | null;
  lines: CartLineInput[];
}
