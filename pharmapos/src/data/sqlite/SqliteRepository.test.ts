import { beforeEach, describe, it, expect } from 'vitest';
import { createTestDriver } from '../../test/sqljs';
import { seedDemoData } from '../seed';
import { SqliteRepository } from './SqliteRepository';
import type { SqlDriver } from '../sql/SqlDriver';
import type { NewSaleInput } from '../repository';
import type { Product } from '../types';

let driver: SqlDriver;
let repo: SqliteRepository;

async function countWhere(table: string, col: string, value: string): Promise<number> {
  const rows = await driver.select<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?`,
    [value],
  );
  return rows[0].n;
}

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

describe('seed + reads', () => {
  it('seeds products, stock batches and the current exchange rate', async () => {
    expect((await repo.products.list()).length).toBe(8);
    const rate = await repo.exchangeRates.current();
    expect(rate?.usd_to_lbp).toBe(89000);
    expect(await repo.settings.get('ll_rounding_step')).toBe('1000');

    const panadol = await findProduct('Panadol');
    const batches = await repo.batches.listByProduct(panadol.id);
    expect(batches[0].qty_on_hand).toBe(40);
  });
});

describe('createCompleted — the Phase 1 gate', () => {
  it('rings up a dual-currency sale, persists it, and decrements stock via movements', async () => {
    const panadol = await findProduct('Panadol'); // 250¢, qty 40
    const augmentin = await findProduct('Augmentin'); // 1200¢, qty 25
    const panadolBatch = (await repo.batches.listByProduct(panadol.id))[0];
    const augmentinBatch = (await repo.batches.listByProduct(augmentin.id))[0];
    const rate = (await repo.exchangeRates.current())!.usd_to_lbp;

    const input: NewSaleInput = {
      branch_id: panadolBatch.branch_id,
      user_id: 'u-test',
      customer_id: null,
      lines: [
        {
          product_id: panadol.id,
          batch_id: panadolBatch.id,
          qty: 2,
          unit_price_usd_cents: panadol.price_usd_cents,
          line_discount_usd_cents: 0,
          vat_rate: panadol.vat_rate,
        },
        {
          product_id: augmentin.id,
          batch_id: augmentinBatch.id,
          qty: 1,
          unit_price_usd_cents: augmentin.price_usd_cents,
          line_discount_usd_cents: 0,
          vat_rate: augmentin.vat_rate,
        },
      ],
      // Mixed payment: $10.00 + 700,000 L.L. (≈ $7.87) covers the $17.00 total.
      payments: [
        { currency: 'USD', amount_minor: 1000, method: 'cash' },
        { currency: 'LBP', amount_minor: 700000, method: 'cash' },
      ],
      discount_usd_cents: 0,
      exchange_rate: rate,
      ll_rounding_cents: 0,
      prescription_ref: null,
    };

    const sale = await repo.sales.createCompleted(input);

    // Totals (VAT-inclusive): 2×250 + 1×1200 = 1700; VAT component = 50 + 119 = 169.
    expect(sale.total_usd_cents).toBe(1700);
    expect(sale.subtotal_usd_cents).toBe(1700);
    expect(sale.vat_usd_cents).toBe(169);
    expect(sale.status).toBe('completed');
    expect(sale.exchange_rate).toBe(89000); // snapshotted

    // Persisted in SQLite and reloads identically.
    const reloaded = await repo.sales.get(sale.id);
    expect(reloaded).toEqual(sale);

    // Lines + payments persisted.
    expect(await countWhere('sale_lines', 'sale_id', sale.id)).toBe(2);
    expect(await countWhere('payments', 'sale_id', sale.id)).toBe(2);

    // Stock decremented via stock_movements (the source of truth).
    const movements = await driver.select<{ qty_delta: number; type: string; product_id: string }>(
      'SELECT qty_delta, type, product_id FROM stock_movements WHERE ref_id = ? ORDER BY qty_delta',
      [sale.id],
    );
    expect(movements).toHaveLength(2);
    expect(movements.map((m) => m.qty_delta)).toEqual([-2, -1]);
    expect(movements.every((m) => m.type === 'sale')).toBe(true);

    // And the derived qty_on_hand cache followed.
    expect((await repo.batches.get(panadolBatch.id))!.qty_on_hand).toBe(38);
    expect((await repo.batches.get(augmentinBatch.id))!.qty_on_hand).toBe(24);
  });

  it('rejects an underpaid sale and writes nothing', async () => {
    const panadol = await findProduct('Panadol');
    const batch = (await repo.batches.listByProduct(panadol.id))[0];
    const salesBefore = (await repo.sales.list()).length;

    const input: NewSaleInput = {
      branch_id: batch.branch_id,
      user_id: 'u-test',
      customer_id: null,
      lines: [
        {
          product_id: panadol.id,
          batch_id: batch.id,
          qty: 2,
          unit_price_usd_cents: panadol.price_usd_cents,
          line_discount_usd_cents: 0,
          vat_rate: panadol.vat_rate,
        },
      ],
      payments: [{ currency: 'USD', amount_minor: 100, method: 'cash' }], // far too little
      discount_usd_cents: 0,
      exchange_rate: 89000,
      ll_rounding_cents: 0,
      prescription_ref: null,
    };

    await expect(repo.sales.createCompleted(input)).rejects.toThrow(/do not cover/);

    // Nothing changed: no new sale, stock intact.
    expect((await repo.sales.list()).length).toBe(salesBefore);
    expect((await repo.batches.get(batch.id))!.qty_on_hand).toBe(40);
  });
});
