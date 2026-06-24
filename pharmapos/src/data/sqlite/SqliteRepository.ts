/**
 * SQLite implementation of the Repository contract (desktop / offline modes).
 *
 * STUB (Phase 0): the interface is wired up and type-checks, but the bodies are
 * filled in during Phase 1, backed by `tauri-plugin-sql` (a single SQLite file).
 * Keeping it here proves the UI ↔ data boundary compiles against a real class.
 */

import {
  NotImplementedError,
  type BatchRepository,
  type ExchangeRateRepository,
  type NewSaleInput,
  type ProductRepository,
  type Repository,
  type SaleQuery,
  type SaleRepository,
  type SettingsRepository,
} from '../repository';
import type { Batch, ExchangeRate, Product, Sale, Setting, UUID } from '../types';

class SqliteProductRepository implements ProductRepository {
  list(): Promise<Product[]> {
    throw new NotImplementedError('SqliteRepository.products.list');
  }
  get(_id: UUID): Promise<Product | null> {
    throw new NotImplementedError('SqliteRepository.products.get');
  }
  search(_query: string): Promise<Product[]> {
    throw new NotImplementedError('SqliteRepository.products.search');
  }
  upsert(_product: Product): Promise<Product> {
    throw new NotImplementedError('SqliteRepository.products.upsert');
  }
  softDelete(_id: UUID): Promise<void> {
    throw new NotImplementedError('SqliteRepository.products.softDelete');
  }
}

class SqliteBatchRepository implements BatchRepository {
  listByProduct(_productId: UUID): Promise<Batch[]> {
    throw new NotImplementedError('SqliteRepository.batches.listByProduct');
  }
  get(_id: UUID): Promise<Batch | null> {
    throw new NotImplementedError('SqliteRepository.batches.get');
  }
  upsert(_batch: Batch): Promise<Batch> {
    throw new NotImplementedError('SqliteRepository.batches.upsert');
  }
}

class SqliteSaleRepository implements SaleRepository {
  createCompleted(_input: NewSaleInput): Promise<Sale> {
    throw new NotImplementedError('SqliteRepository.sales.createCompleted');
  }
  get(_id: UUID): Promise<Sale | null> {
    throw new NotImplementedError('SqliteRepository.sales.get');
  }
  list(_query?: SaleQuery): Promise<Sale[]> {
    throw new NotImplementedError('SqliteRepository.sales.list');
  }
}

class SqliteExchangeRateRepository implements ExchangeRateRepository {
  current(): Promise<ExchangeRate | null> {
    throw new NotImplementedError('SqliteRepository.exchangeRates.current');
  }
  history(): Promise<ExchangeRate[]> {
    throw new NotImplementedError('SqliteRepository.exchangeRates.history');
  }
  set(_usdToLbp: number, _createdBy: UUID | null): Promise<ExchangeRate> {
    throw new NotImplementedError('SqliteRepository.exchangeRates.set');
  }
}

class SqliteSettingsRepository implements SettingsRepository {
  get(_key: string): Promise<string | null> {
    throw new NotImplementedError('SqliteRepository.settings.get');
  }
  set(_key: string, _value: string): Promise<void> {
    throw new NotImplementedError('SqliteRepository.settings.set');
  }
  all(): Promise<Setting[]> {
    throw new NotImplementedError('SqliteRepository.settings.all');
  }
}

export class SqliteRepository implements Repository {
  readonly products: ProductRepository = new SqliteProductRepository();
  readonly batches: BatchRepository = new SqliteBatchRepository();
  readonly sales: SaleRepository = new SqliteSaleRepository();
  readonly exchangeRates: ExchangeRateRepository = new SqliteExchangeRateRepository();
  readonly settings: SettingsRepository = new SqliteSettingsRepository();
}
