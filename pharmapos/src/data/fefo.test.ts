import { describe, it, expect } from 'vitest';
import { availableQty, fefoOrder, pickFefoBatch } from './fefo';
import type { Batch } from './types';

function batch(partial: Partial<Batch> & { id: string }): Batch {
  return {
    product_id: 'p1',
    branch_id: 'br1',
    batch_no: null,
    expiry_date: null,
    qty_on_hand: 0,
    cost_usd_cents: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    last_modified_by: null,
    sync_version: 0,
    ...partial,
  };
}

const A = batch({ id: 'A', expiry_date: '2026-08-31', qty_on_hand: 3 }); // sooner
const B = batch({ id: 'B', expiry_date: '2027-01-31', qty_on_hand: 10 }); // later
const N = batch({ id: 'N', expiry_date: null, qty_on_hand: 5 }); // no expiry

describe('availableQty', () => {
  it('sums live batches and ignores deleted ones', () => {
    expect(availableQty([A, B, N])).toBe(18);
    expect(availableQty([A, batch({ id: 'D', qty_on_hand: 99, deleted_at: 'x' })])).toBe(3);
  });
});

describe('fefoOrder', () => {
  it('orders earliest expiry first, no-expiry last', () => {
    expect(fefoOrder([N, B, A]).map((b) => b.id)).toEqual(['A', 'B', 'N']);
  });

  it('breaks ties by created_at and does not mutate the input', () => {
    const input = [
      batch({ id: 'late', expiry_date: '2026-08-31', created_at: '2026-02-01T00:00:00.000Z' }),
      batch({ id: 'early', expiry_date: '2026-08-31', created_at: '2026-01-01T00:00:00.000Z' }),
    ];
    expect(fefoOrder(input).map((b) => b.id)).toEqual(['early', 'late']);
    expect(input.map((b) => b.id)).toEqual(['late', 'early']); // unchanged
  });
});

describe('pickFefoBatch', () => {
  it('picks the earliest-expiry batch that has stock', () => {
    expect(pickFefoBatch([B, A, N])?.id).toBe('A');
  });

  it('skips empty/deleted batches', () => {
    const empty = batch({ id: 'A0', expiry_date: '2026-02-01', qty_on_hand: 0 });
    const gone = batch({ id: 'A1', expiry_date: '2026-03-01', qty_on_hand: 9, deleted_at: 'x' });
    expect(pickFefoBatch([empty, gone, B])?.id).toBe('B');
  });

  it('returns null when nothing is in stock', () => {
    expect(pickFefoBatch([batch({ id: 'z', qty_on_hand: 0 })])).toBeNull();
  });
});
