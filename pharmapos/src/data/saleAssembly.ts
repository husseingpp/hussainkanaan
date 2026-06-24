/**
 * Pure sale assembly — the money brain of checkout.
 *
 * Turns a `NewSaleInput` into the exact rows that must be persisted: the sale, its
 * lines, payments, and stock movements. No I/O — repositories call this, then write
 * the result inside one transaction. All arithmetic goes through money.ts.
 *
 * Pricing model (locked in Phase 1): unit prices are VAT-INCLUSIVE. The VAT figure on
 * the sale is the VAT *component* of the (discounted) total; the customer total equals
 * the sum of shelf prices minus discounts.
 */

import { newId, nowIso } from '../lib/ids';
import { extractInclusiveVat, roundDiv, settle, type PaymentInput } from '../lib/money';
import type { NewSaleInput } from './repository';
import type { Payment, Sale, SaleLine, StockMovement, SyncMeta, UUID } from './types';

export interface AssembledSale {
  sale: Sale;
  lines: SaleLine[];
  payments: Payment[];
  movements: StockMovement[];
}

function meta(id: UUID, now: string, userId: UUID): SyncMeta {
  return {
    id,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    last_modified_by: userId,
    sync_version: 0,
  };
}

/** The minimal per-line shape needed to compute totals (a subset of NewSaleLineInput). */
export interface TotalsLine {
  qty: number;
  unit_price_usd_cents: number;
  line_discount_usd_cents: number;
  vat_rate: number;
}

export interface SaleTotals {
  /** Per-line VAT-inclusive totals (after the per-line discount). */
  lineTotals: number[];
  subtotal_usd_cents: number;
  discount_usd_cents: number;
  vat_usd_cents: number;
  total_usd_cents: number;
}

/**
 * Pure totals math shared by the Checkout preview and the persisted sale, so the
 * number the cashier sees is exactly the number that gets written. Prices are
 * VAT-inclusive; `vat_usd_cents` is the VAT component extracted from the discounted total.
 */
export function computeTotals(lines: TotalsLine[], wholeDiscountUsdCents: number): SaleTotals {
  const lineTotals = lines.map(
    (l) => l.qty * l.unit_price_usd_cents - l.line_discount_usd_cents,
  );
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  const total = subtotal - wholeDiscountUsdCents;

  const allocations = allocateDiscount(lineTotals, subtotal, wholeDiscountUsdCents);
  let vat = 0;
  for (let i = 0; i < lines.length; i += 1) {
    vat += extractInclusiveVat(lineTotals[i] - allocations[i], lines[i].vat_rate).vat;
  }

  return {
    lineTotals,
    subtotal_usd_cents: subtotal,
    discount_usd_cents: wholeDiscountUsdCents,
    vat_usd_cents: vat,
    total_usd_cents: total,
  };
}

/**
 * Apportion a whole-sale discount across lines in proportion to each line total,
 * giving the last line the remainder so the parts sum back to `discount` exactly.
 */
function allocateDiscount(lineTotals: number[], subtotal: number, discount: number): number[] {
  if (discount <= 0 || subtotal <= 0) {
    return lineTotals.map(() => 0);
  }
  const allocations: number[] = [];
  let assigned = 0;
  for (let i = 0; i < lineTotals.length; i += 1) {
    if (i === lineTotals.length - 1) {
      allocations.push(discount - assigned);
    } else {
      const share = roundDiv(discount * lineTotals[i], subtotal);
      allocations.push(share);
      assigned += share;
    }
  }
  return allocations;
}

export function assembleSale(input: NewSaleInput): AssembledSale {
  if (input.lines.length === 0) {
    throw new Error('saleAssembly: cannot complete a sale with no lines');
  }

  const now = nowIso();
  const saleId = newId();

  // 1. Totals (VAT-inclusive) — the same math the Checkout preview uses.
  const lineGross = input.lines.map((l) => l.qty * l.unit_price_usd_cents - l.line_discount_usd_cents);
  if (lineGross.some((t) => t < 0)) {
    throw new Error('saleAssembly: a line discount exceeds the line amount');
  }
  const subtotal = lineGross.reduce((a, b) => a + b, 0);
  if (input.discount_usd_cents < 0 || input.discount_usd_cents > subtotal) {
    throw new Error('saleAssembly: invalid whole-sale discount');
  }
  const totals = computeTotals(input.lines, input.discount_usd_cents);
  const lineTotals = totals.lineTotals;

  // 2. Settlement guard — payments (converted at the sale's rate) must cover the total.
  const paymentInputs: PaymentInput[] = input.payments.map((p) => ({
    currency: p.currency,
    amountMinor: p.amount_minor,
  }));
  if (!settle(paymentInputs, totals.total_usd_cents, input.exchange_rate).settled) {
    throw new Error('saleAssembly: payments do not cover the sale total');
  }

  // 3. Build the rows.
  const sale: Sale = {
    ...meta(saleId, now, input.user_id),
    branch_id: input.branch_id,
    user_id: input.user_id,
    customer_id: input.customer_id,
    status: 'completed',
    subtotal_usd_cents: totals.subtotal_usd_cents,
    discount_usd_cents: totals.discount_usd_cents,
    vat_usd_cents: totals.vat_usd_cents,
    total_usd_cents: totals.total_usd_cents,
    exchange_rate: input.exchange_rate,
    ll_rounding_cents: input.ll_rounding_cents,
    prescription_ref: input.prescription_ref,
  };

  const lines: SaleLine[] = input.lines.map((l, i) => ({
    ...meta(newId(), now, input.user_id),
    sale_id: saleId,
    product_id: l.product_id,
    batch_id: l.batch_id,
    qty: l.qty,
    unit_price_usd_cents: l.unit_price_usd_cents,
    line_discount_usd_cents: l.line_discount_usd_cents,
    line_total_usd_cents: lineTotals[i],
  }));

  const payments: Payment[] = input.payments.map((p) => ({
    ...meta(newId(), now, input.user_id),
    sale_id: saleId,
    currency: p.currency,
    amount_minor: p.amount_minor,
    method: p.method,
  }));

  const movements: StockMovement[] = input.lines.map((l) => ({
    ...meta(newId(), now, input.user_id),
    product_id: l.product_id,
    batch_id: l.batch_id,
    branch_id: input.branch_id,
    type: 'sale',
    qty_delta: -l.qty,
    ref_id: saleId,
  }));

  return { sale, lines, payments, movements };
}
