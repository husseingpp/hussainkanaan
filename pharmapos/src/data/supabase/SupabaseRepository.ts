/**
 * Supabase (Postgres) implementation of the Repository contract — cloud mode.
 *
 * Reuses the pure core: `assembleSale` builds the sale rows (money stays in money.ts), and
 * `create_sale` (a Postgres RPC) writes them atomically; `classifyExpiry` buckets the expiry
 * report. Permissive MVP: the anon key + allow-all RLS, no auth gating yet.
 */

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { newId, nowIso } from '../../lib/ids';
import { classifyExpiry, daysUntil } from '../expiry';
import { assembleSale } from '../saleAssembly';
import {
  type BatchRepository,
  type ExchangeRateRepository,
  type ExpiryRow,
  type InventoryRepository,
  type LowStockRow,
  type NewSaleInput,
  type ProductRepository,
  type ReceiveStockInput,
  type Repository,
  type SaleQuery,
  type SaleRepository,
  type SettingsRepository,
} from '../repository';
import type { Batch, ExchangeRate, Product, Sale, Setting, StockMovement, UUID } from '../types';

interface Result<T> {
  data: T | null;
  error: PostgrestError | null;
}

function rows<T>(res: Result<T[]>): T[] {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T[];
}

function maybe<T>(res: Result<T>): T | null {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

function ok(res: { error: PostgrestError | null }): void {
  if (res.error) throw new Error(res.error.message);
}

/** Sanitise free text before embedding it in a PostgREST `.or(...)` filter. */
function sanitize(q: string): string {
  return q.replace(/[,()%*]/g, ' ').trim();
}

class SupabaseProductRepository implements ProductRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async list(): Promise<Product[]> {
    return rows<Product>(
      await this.sb.from('products').select('*').is('deleted_at', null).order('name'),
    );
  }

  async get(id: UUID): Promise<Product | null> {
    return maybe<Product>(
      await this.sb.from('products').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
    );
  }

  async search(query: string): Promise<Product[]> {
    const q = sanitize(query);
    if (q === '') return this.list();
    return rows<Product>(
      await this.sb
        .from('products')
        .select('*')
        .is('deleted_at', null)
        .eq('active', true)
        .or(
          `name.ilike.%${q}%,generic_name.ilike.%${q}%,brand.ilike.%${q}%,barcode.ilike.%${q}%`,
        )
        .order('name')
        .limit(50),
    );
  }

  async upsert(product: Product): Promise<Product> {
    ok(await this.sb.from('products').upsert(product, { onConflict: 'id' }));
    return product;
  }

  async softDelete(id: UUID): Promise<void> {
    const now = nowIso();
    ok(await this.sb.from('products').update({ deleted_at: now, updated_at: now }).eq('id', id));
  }
}

class SupabaseBatchRepository implements BatchRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async listByProduct(productId: UUID): Promise<Batch[]> {
    return rows<Batch>(
      await this.sb
        .from('batches')
        .select('*')
        .eq('product_id', productId)
        .is('deleted_at', null)
        .order('expiry_date', { ascending: true, nullsFirst: false }),
    );
  }

  async get(id: UUID): Promise<Batch | null> {
    return maybe<Batch>(
      await this.sb.from('batches').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
    );
  }

  async upsert(batch: Batch): Promise<Batch> {
    ok(await this.sb.from('batches').upsert(batch, { onConflict: 'id' }));
    return batch;
  }
}

class SupabaseSaleRepository implements SaleRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async createCompleted(input: NewSaleInput): Promise<Sale> {
    const { sale, lines, payments, movements } = assembleSale(input);
    ok(
      await this.sb.rpc('create_sale', {
        p_sale: sale,
        p_lines: lines,
        p_payments: payments,
        p_movements: movements,
      }),
    );
    return sale;
  }

  async get(id: UUID): Promise<Sale | null> {
    return maybe<Sale>(await this.sb.from('sales').select('*').eq('id', id).maybeSingle());
  }

  async list(query: SaleQuery = {}): Promise<Sale[]> {
    let q = this.sb.from('sales').select('*').is('deleted_at', null);
    if (query.branch_id) q = q.eq('branch_id', query.branch_id);
    if (query.status) q = q.eq('status', query.status);
    if (query.from) q = q.gte('created_at', query.from);
    if (query.to) q = q.lt('created_at', query.to);
    return rows<Sale>(await q.order('created_at', { ascending: false }));
  }
}

class SupabaseExchangeRateRepository implements ExchangeRateRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async current(): Promise<ExchangeRate | null> {
    return maybe<ExchangeRate>(
      await this.sb
        .from('exchange_rates')
        .select('*')
        .is('deleted_at', null)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
  }

  async history(): Promise<ExchangeRate[]> {
    return rows<ExchangeRate>(
      await this.sb
        .from('exchange_rates')
        .select('*')
        .is('deleted_at', null)
        .order('effective_from', { ascending: false }),
    );
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
    ok(await this.sb.from('exchange_rates').insert(rate));
    return rate;
  }
}

class SupabaseSettingsRepository implements SettingsRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async get(key: string): Promise<string | null> {
    const row = maybe<{ value: string }>(
      await this.sb.from('settings').select('value').eq('key', key).maybeSingle(),
    );
    return row ? row.value : null;
  }

  async set(key: string, value: string): Promise<void> {
    ok(await this.sb.from('settings').upsert({ key, value }, { onConflict: 'key' }));
  }

  async all(): Promise<Setting[]> {
    return rows<Setting>(await this.sb.from('settings').select('key, value').order('key'));
  }
}

class SupabaseInventoryRepository implements InventoryRepository {
  constructor(private readonly sb: SupabaseClient) {}

  async receiveStock(input: ReceiveStockInput): Promise<Batch> {
    const now = nowIso();
    let query = this.sb
      .from('batches')
      .select('*')
      .eq('product_id', input.product_id)
      .is('deleted_at', null);
    query = input.batch_no === null ? query.is('batch_no', null) : query.eq('batch_no', input.batch_no);
    const existing = maybe<Batch>(await query.limit(1).maybeSingle());

    const batch: Batch = existing
      ? {
          ...existing,
          qty_on_hand: existing.qty_on_hand + input.qty,
          expiry_date: input.expiry_date ?? existing.expiry_date,
          cost_usd_cents: input.cost_usd_cents,
          updated_at: now,
          sync_version: existing.sync_version + 1,
          last_modified_by: input.user_id,
        }
      : {
          id: newId(),
          product_id: input.product_id,
          branch_id: input.branch_id,
          batch_no: input.batch_no,
          expiry_date: input.expiry_date,
          qty_on_hand: input.qty,
          cost_usd_cents: input.cost_usd_cents,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          last_modified_by: input.user_id,
          sync_version: 0,
        };

    ok(await this.sb.from('batches').upsert(batch, { onConflict: 'id' }));
    ok(await this.sb.from('stock_movements').insert(this.movement(batch, 'purchase', input.qty, input.user_id, now)));
    return batch;
  }

  async adjustStock(batchId: UUID, qtyDelta: number, userId: UUID | null): Promise<void> {
    const now = nowIso();
    const current = maybe<Batch>(
      await this.sb.from('batches').select('*').eq('id', batchId).maybeSingle(),
    );
    if (!current) throw new Error(`adjustStock: batch ${batchId} not found`);
    const updated: Batch = {
      ...current,
      qty_on_hand: current.qty_on_hand + qtyDelta,
      updated_at: now,
      sync_version: current.sync_version + 1,
      last_modified_by: userId,
    };
    ok(await this.sb.from('batches').upsert(updated, { onConflict: 'id' }));
    ok(await this.sb.from('stock_movements').insert(this.movement(updated, 'adjustment', qtyDelta, userId, now)));
  }

  async lowStock(threshold: number): Promise<LowStockRow[]> {
    const stock = rows<{ product_id: string; on_hand: number }>(
      await this.sb
        .from('product_stock')
        .select('product_id, on_hand')
        .lt('on_hand', threshold)
        .order('on_hand', { ascending: true }),
    );
    if (stock.length === 0) return [];
    const products = rows<Product>(
      await this.sb
        .from('products')
        .select('*')
        .is('deleted_at', null)
        .eq('active', true)
        .in('id', stock.map((s) => s.product_id)),
    );
    const byId = new Map(products.map((p) => [p.id, p]));
    return stock
      .filter((s) => byId.has(s.product_id))
      .map((s) => ({ product: byId.get(s.product_id)!, on_hand: s.on_hand }));
  }

  async expiryReport(asOfIso: string, nearDays: number): Promise<ExpiryRow[]> {
    const batches = rows<Batch>(
      await this.sb
        .from('batches')
        .select('*')
        .is('deleted_at', null)
        .gt('qty_on_hand', 0)
        .order('expiry_date', { ascending: true, nullsFirst: false }),
    );
    const products = rows<Product>(
      await this.sb.from('products').select('*').is('deleted_at', null),
    );
    const byId = new Map(products.map((p) => [p.id, p]));

    const out: ExpiryRow[] = [];
    for (const batch of batches) {
      const product = byId.get(batch.product_id);
      if (!product) continue;
      out.push({
        batch,
        product,
        bucket: classifyExpiry(batch.expiry_date, asOfIso, nearDays),
        days_to_expiry: batch.expiry_date ? daysUntil(batch.expiry_date, asOfIso) : null,
      });
    }
    return out;
  }

  private movement(
    batch: Batch,
    type: StockMovement['type'],
    qtyDelta: number,
    userId: UUID | null,
    now: string,
  ): StockMovement {
    return {
      id: newId(),
      product_id: batch.product_id,
      batch_id: batch.id,
      branch_id: batch.branch_id,
      type,
      qty_delta: qtyDelta,
      ref_id: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      last_modified_by: userId,
      sync_version: 0,
    };
  }
}

export class SupabaseRepository implements Repository {
  readonly products: ProductRepository;
  readonly batches: BatchRepository;
  readonly sales: SaleRepository;
  readonly exchangeRates: ExchangeRateRepository;
  readonly settings: SettingsRepository;
  readonly inventory: InventoryRepository;

  constructor(sb: SupabaseClient) {
    this.products = new SupabaseProductRepository(sb);
    this.batches = new SupabaseBatchRepository(sb);
    this.sales = new SupabaseSaleRepository(sb);
    this.exchangeRates = new SupabaseExchangeRateRepository(sb);
    this.settings = new SupabaseSettingsRepository(sb);
    this.inventory = new SupabaseInventoryRepository(sb);
  }
}
