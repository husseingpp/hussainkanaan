/**
 * SQLite implementation of the Repository contract (desktop / offline modes).
 *
 * Engine-agnostic: it talks to a `SqlDriver`, so the same code runs against
 * tauri-plugin-sql (production) and sql.js (Node tests + browser dev). All money
 * is integer minor units; sale math goes through `assembleSale` (money.ts).
 */

import { newId, nowIso } from '../../lib/ids';
import { assembleSale } from '../saleAssembly';
import { withTransaction, type SqlDriver } from '../sql/SqlDriver';
import {
  type BatchRepository,
  type ExchangeRateRepository,
  type NewSaleInput,
  type ProductRepository,
  type Repository,
  type SaleQuery,
  type SaleRepository,
  type SettingsRepository,
} from '../repository';
import type {
  Batch,
  ExchangeRate,
  Payment,
  Product,
  Sale,
  SaleLine,
  Setting,
  StockMovement,
  UUID,
} from '../types';

type Row = Record<string, string | number | null>;

const bool = (v: boolean): number => (v ? 1 : 0);

function rowToProduct(r: Row): Product {
  return {
    id: r.id as string,
    sku: (r.sku as string | null) ?? null,
    barcode: (r.barcode as string | null) ?? null,
    name: r.name as string,
    generic_name: (r.generic_name as string | null) ?? null,
    brand: (r.brand as string | null) ?? null,
    form: (r.form as string | null) ?? null,
    strength: (r.strength as string | null) ?? null,
    category_id: (r.category_id as string | null) ?? null,
    supplier_id: (r.supplier_id as string | null) ?? null,
    price_usd_cents: r.price_usd_cents as number,
    cost_usd_cents: r.cost_usd_cents as number,
    vat_rate: r.vat_rate as number,
    is_controlled: !!r.is_controlled,
    active: !!r.active,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    deleted_at: (r.deleted_at as string | null) ?? null,
    last_modified_by: (r.last_modified_by as string | null) ?? null,
    sync_version: r.sync_version as number,
  };
}

function rowToBatch(r: Row): Batch {
  return {
    id: r.id as string,
    product_id: r.product_id as string,
    branch_id: r.branch_id as string,
    batch_no: (r.batch_no as string | null) ?? null,
    expiry_date: (r.expiry_date as string | null) ?? null,
    qty_on_hand: r.qty_on_hand as number,
    cost_usd_cents: r.cost_usd_cents as number,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    deleted_at: (r.deleted_at as string | null) ?? null,
    last_modified_by: (r.last_modified_by as string | null) ?? null,
    sync_version: r.sync_version as number,
  };
}

function rowToSale(r: Row): Sale {
  return {
    id: r.id as string,
    branch_id: r.branch_id as string,
    user_id: r.user_id as string,
    customer_id: (r.customer_id as string | null) ?? null,
    status: r.status as Sale['status'],
    subtotal_usd_cents: r.subtotal_usd_cents as number,
    discount_usd_cents: r.discount_usd_cents as number,
    vat_usd_cents: r.vat_usd_cents as number,
    total_usd_cents: r.total_usd_cents as number,
    exchange_rate: r.exchange_rate as number,
    ll_rounding_cents: r.ll_rounding_cents as number,
    prescription_ref: (r.prescription_ref as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    deleted_at: (r.deleted_at as string | null) ?? null,
    last_modified_by: (r.last_modified_by as string | null) ?? null,
    sync_version: r.sync_version as number,
  };
}

function rowToExchangeRate(r: Row): ExchangeRate {
  return {
    id: r.id as string,
    usd_to_lbp: r.usd_to_lbp as number,
    effective_from: r.effective_from as string,
    created_by: (r.created_by as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    deleted_at: (r.deleted_at as string | null) ?? null,
    last_modified_by: (r.last_modified_by as string | null) ?? null,
    sync_version: r.sync_version as number,
  };
}

class SqliteProductRepository implements ProductRepository {
  constructor(private readonly db: SqlDriver) {}

  async list(): Promise<Product[]> {
    const rows = await this.db.select<Row>(
      'SELECT * FROM products WHERE deleted_at IS NULL ORDER BY name',
    );
    return rows.map(rowToProduct);
  }

  async get(id: UUID): Promise<Product | null> {
    const rows = await this.db.select<Row>(
      'SELECT * FROM products WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    return rows.length ? rowToProduct(rows[0]) : null;
  }

  async search(query: string): Promise<Product[]> {
    const like = `%${query}%`;
    const rows = await this.db.select<Row>(
      `SELECT * FROM products
       WHERE deleted_at IS NULL AND active = 1
         AND (name LIKE ? OR generic_name LIKE ? OR brand LIKE ? OR sku LIKE ? OR barcode = ?)
       ORDER BY name
       LIMIT 50`,
      [like, like, like, like, query],
    );
    return rows.map(rowToProduct);
  }

  async upsert(p: Product): Promise<Product> {
    await this.db.execute(
      `INSERT INTO products
         (id, sku, barcode, name, generic_name, brand, form, strength, category_id, supplier_id,
          price_usd_cents, cost_usd_cents, vat_rate, is_controlled, active,
          created_at, updated_at, deleted_at, last_modified_by, sync_version)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         sku=excluded.sku, barcode=excluded.barcode, name=excluded.name,
         generic_name=excluded.generic_name, brand=excluded.brand, form=excluded.form,
         strength=excluded.strength, category_id=excluded.category_id, supplier_id=excluded.supplier_id,
         price_usd_cents=excluded.price_usd_cents, cost_usd_cents=excluded.cost_usd_cents,
         vat_rate=excluded.vat_rate, is_controlled=excluded.is_controlled, active=excluded.active,
         updated_at=excluded.updated_at, deleted_at=excluded.deleted_at,
         last_modified_by=excluded.last_modified_by, sync_version=excluded.sync_version`,
      [
        p.id, p.sku, p.barcode, p.name, p.generic_name, p.brand, p.form, p.strength,
        p.category_id, p.supplier_id, p.price_usd_cents, p.cost_usd_cents, p.vat_rate,
        bool(p.is_controlled), bool(p.active), p.created_at, p.updated_at, p.deleted_at,
        p.last_modified_by, p.sync_version,
      ],
    );
    return p;
  }

  async softDelete(id: UUID): Promise<void> {
    const now = nowIso();
    await this.db.execute(
      'UPDATE products SET deleted_at = ?, updated_at = ?, sync_version = sync_version + 1 WHERE id = ?',
      [now, now, id],
    );
  }
}

class SqliteBatchRepository implements BatchRepository {
  constructor(private readonly db: SqlDriver) {}

  async listByProduct(productId: UUID): Promise<Batch[]> {
    // FEFO ordering: nearest expiry first (nulls last).
    const rows = await this.db.select<Row>(
      `SELECT * FROM batches
       WHERE product_id = ? AND deleted_at IS NULL
       ORDER BY (expiry_date IS NULL), expiry_date ASC`,
      [productId],
    );
    return rows.map(rowToBatch);
  }

  async get(id: UUID): Promise<Batch | null> {
    const rows = await this.db.select<Row>(
      'SELECT * FROM batches WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    return rows.length ? rowToBatch(rows[0]) : null;
  }

  async upsert(b: Batch): Promise<Batch> {
    await this.db.execute(
      `INSERT INTO batches
         (id, product_id, branch_id, batch_no, expiry_date, qty_on_hand, cost_usd_cents,
          created_at, updated_at, deleted_at, last_modified_by, sync_version)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         product_id=excluded.product_id, branch_id=excluded.branch_id, batch_no=excluded.batch_no,
         expiry_date=excluded.expiry_date, qty_on_hand=excluded.qty_on_hand,
         cost_usd_cents=excluded.cost_usd_cents, updated_at=excluded.updated_at,
         deleted_at=excluded.deleted_at, last_modified_by=excluded.last_modified_by,
         sync_version=excluded.sync_version`,
      [
        b.id, b.product_id, b.branch_id, b.batch_no, b.expiry_date, b.qty_on_hand,
        b.cost_usd_cents, b.created_at, b.updated_at, b.deleted_at, b.last_modified_by,
        b.sync_version,
      ],
    );
    return b;
  }
}

class SqliteSaleRepository implements SaleRepository {
  constructor(private readonly db: SqlDriver) {}

  async createCompleted(input: NewSaleInput): Promise<Sale> {
    const { sale, lines, payments, movements } = assembleSale(input);

    await withTransaction(this.db, async () => {
      await this.insertSale(sale);
      for (const line of lines) await this.insertLine(line);
      for (const p of payments) await this.insertPayment(p);
      for (const m of movements) await this.insertMovement(m);
      // Update the derived qty_on_hand cache (truth stays in stock_movements).
      for (const line of lines) {
        await this.db.execute(
          `UPDATE batches
             SET qty_on_hand = qty_on_hand - ?, updated_at = ?, sync_version = sync_version + 1
           WHERE id = ?`,
          [line.qty, sale.updated_at, line.batch_id],
        );
      }
    });

    return sale;
  }

  async get(id: UUID): Promise<Sale | null> {
    const rows = await this.db.select<Row>('SELECT * FROM sales WHERE id = ?', [id]);
    return rows.length ? rowToSale(rows[0]) : null;
  }

  async list(query: SaleQuery = {}): Promise<Sale[]> {
    const where: string[] = ['deleted_at IS NULL'];
    const params: (string | number)[] = [];
    if (query.branch_id) {
      where.push('branch_id = ?');
      params.push(query.branch_id);
    }
    if (query.status) {
      where.push('status = ?');
      params.push(query.status);
    }
    if (query.from) {
      where.push('created_at >= ?');
      params.push(query.from);
    }
    if (query.to) {
      where.push('created_at < ?');
      params.push(query.to);
    }
    const rows = await this.db.select<Row>(
      `SELECT * FROM sales WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
      params,
    );
    return rows.map(rowToSale);
  }

  private insertSale(s: Sale): Promise<void> {
    return this.db.execute(
      `INSERT INTO sales
         (id, branch_id, user_id, customer_id, status, subtotal_usd_cents, discount_usd_cents,
          vat_usd_cents, total_usd_cents, exchange_rate, ll_rounding_cents, prescription_ref,
          created_at, updated_at, deleted_at, last_modified_by, sync_version)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        s.id, s.branch_id, s.user_id, s.customer_id, s.status, s.subtotal_usd_cents,
        s.discount_usd_cents, s.vat_usd_cents, s.total_usd_cents, s.exchange_rate,
        s.ll_rounding_cents, s.prescription_ref, s.created_at, s.updated_at, s.deleted_at,
        s.last_modified_by, s.sync_version,
      ],
    );
  }

  private insertLine(l: SaleLine): Promise<void> {
    return this.db.execute(
      `INSERT INTO sale_lines
         (id, sale_id, product_id, batch_id, qty, unit_price_usd_cents, line_discount_usd_cents,
          line_total_usd_cents, created_at, updated_at, deleted_at, last_modified_by, sync_version)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        l.id, l.sale_id, l.product_id, l.batch_id, l.qty, l.unit_price_usd_cents,
        l.line_discount_usd_cents, l.line_total_usd_cents, l.created_at, l.updated_at,
        l.deleted_at, l.last_modified_by, l.sync_version,
      ],
    );
  }

  private insertPayment(p: Payment): Promise<void> {
    return this.db.execute(
      `INSERT INTO payments
         (id, sale_id, currency, amount_minor, method, created_at, updated_at, deleted_at,
          last_modified_by, sync_version)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        p.id, p.sale_id, p.currency, p.amount_minor, p.method, p.created_at, p.updated_at,
        p.deleted_at, p.last_modified_by, p.sync_version,
      ],
    );
  }

  private insertMovement(m: StockMovement): Promise<void> {
    return this.db.execute(
      `INSERT INTO stock_movements
         (id, product_id, batch_id, branch_id, type, qty_delta, ref_id, created_at, updated_at,
          deleted_at, last_modified_by, sync_version)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        m.id, m.product_id, m.batch_id, m.branch_id, m.type, m.qty_delta, m.ref_id,
        m.created_at, m.updated_at, m.deleted_at, m.last_modified_by, m.sync_version,
      ],
    );
  }
}

class SqliteExchangeRateRepository implements ExchangeRateRepository {
  constructor(private readonly db: SqlDriver) {}

  async current(): Promise<ExchangeRate | null> {
    const rows = await this.db.select<Row>(
      `SELECT * FROM exchange_rates
       WHERE deleted_at IS NULL
       ORDER BY effective_from DESC, created_at DESC
       LIMIT 1`,
    );
    return rows.length ? rowToExchangeRate(rows[0]) : null;
  }

  async history(): Promise<ExchangeRate[]> {
    const rows = await this.db.select<Row>(
      'SELECT * FROM exchange_rates WHERE deleted_at IS NULL ORDER BY effective_from DESC',
    );
    return rows.map(rowToExchangeRate);
  }

  async set(usdToLbp: number, createdBy: UUID | null): Promise<ExchangeRate> {
    const now = nowIso();
    const rate: ExchangeRate = {
      id: newId(),
      usd_to_lbp: usdToLbp,
      effective_from: now,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      last_modified_by: createdBy,
      sync_version: 0,
    };
    await this.db.execute(
      `INSERT INTO exchange_rates
         (id, usd_to_lbp, effective_from, created_by, created_at, updated_at, deleted_at,
          last_modified_by, sync_version)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        rate.id, rate.usd_to_lbp, rate.effective_from, rate.created_by, rate.created_at,
        rate.updated_at, rate.deleted_at, rate.last_modified_by, rate.sync_version,
      ],
    );
    return rate;
  }
}

class SqliteSettingsRepository implements SettingsRepository {
  constructor(private readonly db: SqlDriver) {}

  async get(key: string): Promise<string | null> {
    const rows = await this.db.select<Row>('SELECT value FROM settings WHERE key = ?', [key]);
    return rows.length ? (rows[0].value as string) : null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.execute(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  }

  async all(): Promise<Setting[]> {
    const rows = await this.db.select<Row>('SELECT key, value FROM settings ORDER BY key');
    return rows.map((r) => ({ key: r.key as string, value: r.value as string }));
  }
}

export class SqliteRepository implements Repository {
  readonly products: ProductRepository;
  readonly batches: BatchRepository;
  readonly sales: SaleRepository;
  readonly exchangeRates: ExchangeRateRepository;
  readonly settings: SettingsRepository;

  constructor(db: SqlDriver) {
    this.products = new SqliteProductRepository(db);
    this.batches = new SqliteBatchRepository(db);
    this.sales = new SqliteSaleRepository(db);
    this.exchangeRates = new SqliteExchangeRateRepository(db);
    this.settings = new SqliteSettingsRepository(db);
  }
}
