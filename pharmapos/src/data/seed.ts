/**
 * Demo seed data. Used by Node tests, the browser dev server, and first-run of the
 * desktop app (so there is something to ring up before goods-received lands in Phase 2).
 * Seeds a branch, a cashier, a category, a handful of pharmacy products with stock
 * batches, an exchange rate, and store settings. Returns the active session ids.
 */

import { newId, nowIso } from '../lib/ids';
import type { SqlDriver } from './sql/SqlDriver';
import { SqliteRepository } from './sqlite/SqliteRepository';
import type { Batch, Product } from './types';

export interface Session {
  branchId: string;
  userId: string;
}

interface DemoProduct {
  name: string;
  generic_name: string;
  brand: string;
  form: string;
  strength: string;
  barcode: string;
  price_usd_cents: number; // VAT-inclusive
  cost_usd_cents: number;
  qty_on_hand: number;
  expiry_date: string;
  is_controlled?: boolean;
}

const DEMO_PRODUCTS: DemoProduct[] = [
  { name: 'Panadol', generic_name: 'Paracetamol', brand: 'GSK', form: 'Tablet', strength: '500mg', barcode: '5000158103368', price_usd_cents: 250, cost_usd_cents: 150, qty_on_hand: 40, expiry_date: '2027-03-31' },
  { name: 'Augmentin', generic_name: 'Amoxicillin/Clavulanate', brand: 'GSK', form: 'Tablet', strength: '1g', barcode: '5099231003684', price_usd_cents: 1200, cost_usd_cents: 800, qty_on_hand: 25, expiry_date: '2026-11-30' },
  { name: 'Brufen', generic_name: 'Ibuprofen', brand: 'Abbott', form: 'Tablet', strength: '400mg', barcode: '5000283662013', price_usd_cents: 350, cost_usd_cents: 200, qty_on_hand: 60, expiry_date: '2027-08-31' },
  { name: 'Concor', generic_name: 'Bisoprolol', brand: 'Merck', form: 'Tablet', strength: '5mg', barcode: '4015630026531', price_usd_cents: 900, cost_usd_cents: 600, qty_on_hand: 30, expiry_date: '2026-09-30' },
  { name: 'Nexium', generic_name: 'Esomeprazole', brand: 'AstraZeneca', form: 'Capsule', strength: '40mg', barcode: '5012894032012', price_usd_cents: 1500, cost_usd_cents: 1000, qty_on_hand: 18, expiry_date: '2026-07-31' },
  { name: 'Voltaren Emulgel', generic_name: 'Diclofenac', brand: 'Novartis', form: 'Gel', strength: '1%', barcode: '7613103651031', price_usd_cents: 700, cost_usd_cents: 450, qty_on_hand: 22, expiry_date: '2027-01-31' },
  { name: 'Ventolin Inhaler', generic_name: 'Salbutamol', brand: 'GSK', form: 'Inhaler', strength: '100mcg', barcode: '5000158009769', price_usd_cents: 1100, cost_usd_cents: 750, qty_on_hand: 15, expiry_date: '2026-12-31' },
  { name: 'Lantus SoloStar', generic_name: 'Insulin Glargine', brand: 'Sanofi', form: 'Pen', strength: '100U/ml', barcode: '3582910086017', price_usd_cents: 2500, cost_usd_cents: 1900, qty_on_hand: 6, expiry_date: '2026-08-31' },
];

/** Extra batches (beyond the one-per-product above) to exercise FEFO + the expiry report. */
const EXTRA_BATCHES: { product: string; batch_no: string; expiry_date: string; qty: number }[] = [
  // Panadol gets an earlier-expiry batch so FEFO must pick it before the main one.
  { product: 'Panadol', batch_no: 'B-EARLY', expiry_date: '2026-09-15', qty: 5 },
  // Brufen gets an already-expired batch so the expiry report has an "expired" row.
  { product: 'Brufen', batch_no: 'B-EXPIRED', expiry_date: '2025-11-30', qty: 8 },
];

const VAT_RATE = 0.11;

export async function seedDemoData(driver: SqlDriver): Promise<Session> {
  const now = nowIso();
  const branchId = newId();
  const userId = newId();
  const categoryId = newId();

  await driver.execute(
    `INSERT INTO branches (id, name, address, phone, created_at, updated_at, deleted_at, last_modified_by, sync_version)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [branchId, 'Main Branch', 'Hamra St, Beirut', '+961 1 000 000', now, now, null, userId, 0],
  );
  await driver.execute(
    `INSERT INTO users (id, branch_id, name, role, pin_hash, supabase_user_id, active, created_at, updated_at, deleted_at, last_modified_by, sync_version)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [userId, branchId, 'Demo Cashier', 'cashier', null, null, 1, now, now, null, userId, 0],
  );
  await driver.execute(
    `INSERT INTO categories (id, name, created_at, updated_at, deleted_at, last_modified_by, sync_version)
     VALUES (?,?,?,?,?,?,?)`,
    [categoryId, 'General', now, now, null, userId, 0],
  );

  const repo = new SqliteRepository(driver);
  const productByName = new Map<string, Product>();

  for (const d of DEMO_PRODUCTS) {
    const product: Product = {
      id: newId(),
      sku: null,
      barcode: d.barcode,
      name: d.name,
      generic_name: d.generic_name,
      brand: d.brand,
      form: d.form,
      strength: d.strength,
      category_id: categoryId,
      supplier_id: null,
      price_usd_cents: d.price_usd_cents,
      cost_usd_cents: d.cost_usd_cents,
      vat_rate: VAT_RATE,
      is_controlled: d.is_controlled ?? false,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      last_modified_by: userId,
      sync_version: 0,
    };
    await repo.products.upsert(product);
    productByName.set(product.name, product);

    const batch: Batch = {
      id: newId(),
      product_id: product.id,
      branch_id: branchId,
      batch_no: `B-${d.barcode.slice(-5)}`,
      expiry_date: d.expiry_date,
      qty_on_hand: d.qty_on_hand,
      cost_usd_cents: d.cost_usd_cents,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      last_modified_by: userId,
      sync_version: 0,
    };
    await repo.batches.upsert(batch);
  }

  for (const extra of EXTRA_BATCHES) {
    const product = productByName.get(extra.product);
    if (!product) continue;
    await repo.batches.upsert({
      id: newId(),
      product_id: product.id,
      branch_id: branchId,
      batch_no: extra.batch_no,
      expiry_date: extra.expiry_date,
      qty_on_hand: extra.qty,
      cost_usd_cents: product.cost_usd_cents,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      last_modified_by: userId,
      sync_version: 0,
    });
  }

  await repo.exchangeRates.set(89000, userId);

  await repo.settings.set('store_name', 'PharmaPOS Demo Pharmacy');
  await repo.settings.set('ll_rounding_step', '1000');
  await repo.settings.set('default_currency', 'LBP');
  await repo.settings.set('near_expiry_days', '90');
  await repo.settings.set('low_stock_threshold', '10');
  await repo.settings.set('current_branch_id', branchId);
  await repo.settings.set('current_user_id', userId);

  return { branchId, userId };
}
