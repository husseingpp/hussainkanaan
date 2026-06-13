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
