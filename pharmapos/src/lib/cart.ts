import { convertMinor } from "./format";
import type { Currency } from "./types";

// A live cart line. Price/stock come from the FEFO batch (`get_sell_info`);
// the authoritative totals are recomputed server-side at checkout.
export interface CartLine {
  product_id: string;
  name: string;
  vat_rate: number;
  batch_currency: Currency;
  batch_unit_price: number; // minor units in batch currency
  available: number;
  qty: number;
}

export interface CartTotals {
  subtotal: number; // minor units of settlement currency
  vat: number;
  grand: number;
  /** false when a line needs currency conversion but no FX rate is set. */
  convertible: boolean;
}

/** A line's unit price in the settlement currency, or null if conversion is blocked. */
export function lineUnitPrice(
  line: CartLine,
  settlement: Currency,
  fx: number | null,
): number | null {
  return convertMinor(line.batch_unit_price, line.batch_currency, settlement, fx);
}

/** Cart totals in the settlement currency. VAT is applied per line. */
export function cartTotals(
  lines: CartLine[],
  settlement: Currency,
  fx: number | null,
): CartTotals {
  let subtotal = 0;
  let vat = 0;
  let convertible = true;

  for (const line of lines) {
    const unit = lineUnitPrice(line, settlement, fx);
    if (unit === null) {
      convertible = false;
      continue;
    }
    const sub = unit * line.qty;
    subtotal += sub;
    vat += Math.round(sub * line.vat_rate);
  }

  return { subtotal, vat, grand: subtotal + vat, convertible };
}
