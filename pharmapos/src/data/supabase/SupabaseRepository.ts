/**
 * Supabase (Postgres) implementation of the Repository contract (cloud mode).
 *
 * STUB (Phase 0): the interface is wired up and type-checks, but the bodies are
 * filled in during Phase 3, backed by `@supabase/supabase-js` against a Postgres
 * schema that mirrors the SQLite schema, with row-level security.
 */

import {
  NotImplementedError,
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
import type { Batch, ExchangeRate, Product, Sale, Setting, UUID } from '../types';

class SupabaseProductRepository implements ProductRepository {
  list(): Promise<Product[]> {
    throw new NotImplementedError('SupabaseRepository.products.list');
  }
  get(_id: UUID): Promise<Product | null> {
    throw new NotImplementedError('SupabaseRepository.products.get');
  }
  search(_query: string): Promise<Product[]> {
    throw new NotImplementedError('SupabaseRepository.products.search');
  }
  upsert(_product: Product): Promise<Product> {
    throw new NotImplementedError('SupabaseRepository.products.upsert');
  }
  softDelete(_id: UUID): Promise<void> {
    throw new NotImplementedError('SupabaseRepository.products.softDelete');
  }
}

class SupabaseBatchRepository implements BatchRepository {
  listByProduct(_productId: UUID): Promise<Batch[]> {
    throw new NotImplementedError('SupabaseRepository.batches.listByProduct');
  }
  get(_id: UUID): Promise<Batch | null> {
    throw new NotImplementedError('SupabaseRepository.batches.get');
  }
  upsert(_batch: Batch): Promise<Batch> {
    throw new NotImplementedError('SupabaseRepository.batches.upsert');
  }
}

class SupabaseSaleRepository implements SaleRepository {
  createCompleted(_input: NewSaleInput): Promise<Sale> {
    throw new NotImplementedError('SupabaseRepository.sales.createCompleted');
  }
  get(_id: UUID): Promise<Sale | null> {
    throw new NotImplementedError('SupabaseRepository.sales.get');
  }
  list(_query?: SaleQuery): Promise<Sale[]> {
    throw new NotImplementedError('SupabaseRepository.sales.list');
  }
}

class SupabaseExchangeRateRepository implements ExchangeRateRepository {
  current(): Promise<ExchangeRate | null> {
    throw new NotImplementedError('SupabaseRepository.exchangeRates.current');
  }
  history(): Promise<ExchangeRate[]> {
    throw new NotImplementedError('SupabaseRepository.exchangeRates.history');
  }
  set(_usdToLbp: number, _createdBy: UUID | null): Promise<ExchangeRate> {
    throw new NotImplementedError('SupabaseRepository.exchangeRates.set');
  }
}

class SupabaseSettingsRepository implements SettingsRepository {
  get(_key: string): Promise<string | null> {
    throw new NotImplementedError('SupabaseRepository.settings.get');
  }
  set(_key: string, _value: string): Promise<void> {
    throw new NotImplementedError('SupabaseRepository.settings.set');
  }
  all(): Promise<Setting[]> {
    throw new NotImplementedError('SupabaseRepository.settings.all');
  }
}

class SupabaseInventoryRepository implements InventoryRepository {
  receiveStock(_input: ReceiveStockInput): Promise<Batch> {
    throw new NotImplementedError('SupabaseRepository.inventory.receiveStock');
  }
  adjustStock(_batchId: UUID, _qtyDelta: number, _userId: UUID | null): Promise<void> {
    throw new NotImplementedError('SupabaseRepository.inventory.adjustStock');
  }
  lowStock(_threshold: number): Promise<LowStockRow[]> {
    throw new NotImplementedError('SupabaseRepository.inventory.lowStock');
  }
  expiryReport(_asOfIso: string, _nearDays: number): Promise<ExpiryRow[]> {
    throw new NotImplementedError('SupabaseRepository.inventory.expiryReport');
  }
}

export class SupabaseRepository implements Repository {
  readonly products: ProductRepository = new SupabaseProductRepository();
  readonly batches: BatchRepository = new SupabaseBatchRepository();
  readonly sales: SaleRepository = new SupabaseSaleRepository();
  readonly exchangeRates: ExchangeRateRepository = new SupabaseExchangeRateRepository();
  readonly settings: SettingsRepository = new SupabaseSettingsRepository();
  readonly inventory: InventoryRepository = new SupabaseInventoryRepository();
}
