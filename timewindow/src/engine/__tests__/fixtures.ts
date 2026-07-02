import { Candle, Dataset, ImportReport } from '../types';

/** Build a candle at a naive broker-time `YYYY.MM.DD HH:MM` with flat OHLC unless given. */
export function candle(
  date: string,
  time: string,
  price: number,
  extra: Partial<Pick<Candle, 'o' | 'h' | 'l' | 'c'>> = {},
): Candle {
  const [y, mo, d] = date.split('.').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const t = Date.UTC(y, mo - 1, d, hh, mm);
  return { t, o: price, h: price, l: price, c: price, ...extra };
}

/** Wrap candles in a minimal Dataset (import report is not used by the engine). */
export function dataset(candles: Candle[], symbol = 'XAUUSD'): Dataset {
  const sorted = [...candles].sort((a, b) => a.t - b.t);
  const report: ImportReport = {
    rowsParsed: sorted.length,
    rowsDropped: 0,
    dateRange: { start: new Date(sorted[0].t), end: new Date(sorted[sorted.length - 1].t) },
    timeframe: 'M1',
    barGapSeconds: 60,
    gaps: [],
    sourceType: 'bars',
  };
  return { id: 'fixture', symbol, candles: sorted, importReport: report };
}

/** All-days-included filter for tests that don't exercise day-of-week filtering. */
export const ALL_DAYS = [true, true, true, true, true, true, true];

/** Generate a continuous run of M1 candles for one UTC day (00:00 → 23:59). */
export function fullDay(date: string, price = 2000): Candle[] {
  const out: Candle[] = [];
  const [y, mo, d] = date.split('.').map(Number);
  for (let min = 0; min < 24 * 60; min++) {
    const t = Date.UTC(y, mo - 1, d, 0, min);
    out.push({ t, o: price, h: price, l: price, c: price });
  }
  return out;
}
