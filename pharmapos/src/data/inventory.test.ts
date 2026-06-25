import { beforeEach, describe, it, expect } from 'vitest';
import { createTestDriver } from '../test/sqljs';
import { seedDemoData } from './seed';
import { SqliteRepository } from './sqlite/SqliteRepository';
import { availableQty } from './fefo';
import type { SqlDriver } from './sql/SqlDriver';
import type { Product } from './types';

const AS_OF = '2026-06-25'; // matches the seed's expiry buckets

let driver: SqlDriver;
let repo: SqliteRepository;

async function findProduct(name: string): Promise<Product> {
  const [p] = await repo.products.search(name);
  if (!p) throw new Error(`seed missing product ${name}`);
  return p;
}

beforeEach(async () => {
  driver = await createTestDriver();
  await seedDemoData(driver);
  repo = new SqliteRepository(driver);
});

describe('receiveStock', () => {
  it('creates a new batch + a purchase movement and raises on-hand', async () => {
    const augmentin = await findProduct('Augmentin');
    const before = availableQty(await repo.batches.listByProduct(augmentin.id)); // 25

    const batch = await repo.inventory.receiveStock({
      product_id: augmentin.id,
      branch_id: (await repo.batches.listByProduct(augmentin.id))[0].branch_id,
      batch_no: 'GR-001',
      expiry_date: '2027-12-31',
      qty: 30,
      cost_usd_cents: 820,
      user_id: 'u-admin',
    });

    expect(batch.qty_on_hand).toBe(30);
    expect(availableQty(await repo.batches.listByProduct(augmentin.id))).toBe(before + 30);

    const moves = await driver.select<{ type: string; qty_delta: number }>(
      'SELECT type, qty_delta FROM stock_movements WHERE batch_id = ?',
      [batch.id],
    );
    expect(moves).toEqual([{ type: 'purchase', qty_delta: 30 }]);
  });

  it('tops up an existing batch matched by product + batch_no', async () => {
    const augmentin = await findProduct('Augmentin');
    const branchId = (await repo.batches.listByProduct(augmentin.id))[0].branch_id;
    const first = await repo.inventory.receiveStock({
      product_id: augmentin.id, branch_id: branchId, batch_no: 'GR-X',
      expiry_date: '2027-12-31', qty: 10, cost_usd_cents: 800, user_id: null,
    });
    const second = await repo.inventory.receiveStock({
      product_id: augmentin.id, branch_id: branchId, batch_no: 'GR-X',
      expiry_date: '2027-12-31', qty: 7, cost_usd_cents: 800, user_id: null,
    });
    expect(second.id).toBe(first.id);
    expect(second.qty_on_hand).toBe(17);
    const count = await driver.select<{ n: number }>(
      'SELECT COUNT(*) AS n FROM stock_movements WHERE batch_id = ?',
      [first.id],
    );
    expect(count[0].n).toBe(2); // two purchase movements
  });
});

describe('adjustStock', () => {
  it('applies a delta + an adjustment movement', async () => {
    const lantus = await findProduct('Lantus SoloStar');
    const batch = (await repo.batches.listByProduct(lantus.id))[0]; // qty 6
    await repo.inventory.adjustStock(batch.id, -2, 'u-admin');
    expect((await repo.batches.get(batch.id))!.qty_on_hand).toBe(4);
    const moves = await driver.select<{ type: string; qty_delta: number }>(
      'SELECT type, qty_delta FROM stock_movements WHERE batch_id = ? AND type = ?',
      [batch.id, 'adjustment'],
    );
    expect(moves).toEqual([{ type: 'adjustment', qty_delta: -2 }]);
  });
});

describe('lowStock', () => {
  it('lists products below the threshold', async () => {
    const low = await repo.inventory.lowStock(10);
    const names = low.map((r) => r.product.name);
    expect(names).toContain('Lantus SoloStar'); // on-hand 6
    expect(names).not.toContain('Panadol'); // 45
    const lantus = low.find((r) => r.product.name === 'Lantus SoloStar')!;
    expect(lantus.on_hand).toBe(6);
  });
});

describe('expiryReport', () => {
  it('buckets batches as expired / expiring / ok', async () => {
    const rows = await repo.inventory.expiryReport(AS_OF, 90);

    const expired = rows.filter((r) => r.bucket === 'expired');
    expect(expired.some((r) => r.product.name === 'Brufen')).toBe(true); // 2025-11-30
    expect(expired.every((r) => (r.days_to_expiry ?? 0) < 0)).toBe(true);

    const expiring = rows.filter((r) => r.bucket === 'expiring');
    // Panadol's early batch (2026-09-15) and Nexium (2026-07-31) fall in the 90-day window.
    expect(expiring.some((r) => r.product.name === 'Panadol')).toBe(true);
    expect(expiring.some((r) => r.product.name === 'Nexium')).toBe(true);

    // Concor (2026-09-30) is just outside the window.
    const concor = rows.find((r) => r.product.name === 'Concor');
    expect(concor?.bucket).toBe('ok');
  });
});
