/**
 * FEFO (first-expiry-first-out) stock selection — pure, no I/O.
 *
 * PharmaPOS uses a single-batch model (locked in Phase 2): a sale line draws from
 * exactly one batch — the earliest-expiring one that still has stock — and its qty
 * is capped at that batch's on-hand. `batches.qty_on_hand` is the derived cache
 * (truth = stock_movements), but it's what we pick against at the till.
 */

import type { Batch } from './types';

/** Total on-hand across live (non-deleted) batches. */
export function availableQty(batches: Batch[]): number {
  return batches.reduce(
    (sum, b) => sum + (b.deleted_at ? 0 : Math.max(0, b.qty_on_hand)),
    0,
  );
}

/**
 * Return a new array ordered FEFO: earliest expiry first, batches with no expiry
 * last, ties broken by oldest `created_at`. Does not mutate the input.
 */
export function fefoOrder(batches: Batch[]): Batch[] {
  return [...batches].sort((a, b) => {
    if (a.expiry_date === null && b.expiry_date === null) {
      return a.created_at.localeCompare(b.created_at);
    }
    if (a.expiry_date === null) return 1; // a (no expiry) goes last
    if (b.expiry_date === null) return -1;
    if (a.expiry_date !== b.expiry_date) return a.expiry_date < b.expiry_date ? -1 : 1;
    return a.created_at.localeCompare(b.created_at);
  });
}

/** The earliest-expiry live batch that still has stock, or null if none. */
export function pickFefoBatch(batches: Batch[]): Batch | null {
  for (const b of fefoOrder(batches)) {
    if (!b.deleted_at && b.qty_on_hand > 0) return b;
  }
  return null;
}
