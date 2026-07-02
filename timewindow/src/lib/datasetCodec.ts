import type { Dataset } from '@/engine';

/** JSON-safe form of a Dataset (Dates in the import report become epoch numbers). */
export interface SerializedDataset {
  id: string;
  symbol: string;
  candles: Dataset['candles'];
  importReport: Omit<Dataset['importReport'], 'dateRange'> & {
    dateRange: { start: number; end: number };
  };
}

/** Small metadata row for listing saved files without loading the candle arrays. */
export interface SavedMeta {
  id: string;
  name: string;
  savedAt: number;
  symbol: string;
  bars: number;
  source: 'bars' | 'ticks';
}

export function serializeDataset(ds: Dataset): SerializedDataset {
  const { dateRange, ...rest } = ds.importReport;
  return {
    id: ds.id,
    symbol: ds.symbol,
    candles: ds.candles,
    importReport: {
      ...rest,
      dateRange: { start: dateRange.start.getTime(), end: dateRange.end.getTime() },
    },
  };
}

export function deserializeDataset(s: SerializedDataset): Dataset {
  const { dateRange, ...rest } = s.importReport;
  return {
    id: s.id,
    symbol: s.symbol,
    candles: s.candles,
    importReport: {
      ...rest,
      dateRange: { start: new Date(dateRange.start), end: new Date(dateRange.end) },
    },
  };
}

export function metaOf(ds: Dataset, name: string): SavedMeta {
  return {
    id: ds.id,
    name,
    savedAt: Date.now(),
    symbol: ds.symbol,
    bars: ds.candles.length,
    source: ds.importReport.sourceType,
  };
}
