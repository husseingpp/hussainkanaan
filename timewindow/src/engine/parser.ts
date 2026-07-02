/**
 * MT5 export parser.
 *
 * Handles the input variants from the blueprint (§3) plus MT5 tick exports:
 *   A. tab-separated M1 bars with angle-bracket headers (`<DATE>\t<TIME>\t<OPEN>…`)
 *   B. comma-separated bars, headers may lack angle brackets
 *   C. tick exports (`<DATE> <TIME> <BID> <ASK> <LAST> …`) → aggregated to M1 (Bid)
 *   D. non-M1 bar data → rejected with a clear message
 *
 * Dates are `YYYY.MM.DD` (also tolerates `-` / `/`) combined with `HH:MM[:SS[.mmm]]`
 * into a naive epoch-ms timestamp — no timezone conversion (broker server time).
 */

import { Candle, DataGap, Dataset, ImportReport, ParseError } from './types';

const M1_SECONDS = 60;
const M1_TOLERANCE = 5; // accept 55–65s median bar gap as M1
const WEEKEND_MS = 40 * 60 * 60 * 1000; // > this after a Friday bar = weekend, not a gap
const INTRAWEEK_GAP_MS = 5 * 60 * 1000; // flag intra-week gaps longer than 5 minutes

/** Header names we recognise — presence of any means the file has a header row. */
const HEADER_KEYS = ['DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'OPEN', 'CLOSE', 'BID', 'ASK'];

type TimestampAccessor = (cells: string[]) => number | null;

/** djb2 string hash → short hex id, used as the dataset fingerprint. */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

/** Strip surrounding angle brackets and normalise a header cell. */
function normHeader(cell: string): string {
  return cell.replace(/^<|>$/g, '').trim().toUpperCase();
}

/** Pick tab or comma by whichever the header line contains more of. */
function detectDelimiter(headerLine: string): '\t' | ',' {
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  if (tabs === 0 && commas === 0) {
    throw new ParseError(
      'Could not detect a column delimiter. Export from MT5 via Chart → right-click → Save As, keeping the default tab-separated columns.',
    );
  }
  return tabs >= commas ? '\t' : ',';
}

/** Combine `YYYY.MM.DD` + `HH:MM[:SS]` into a naive epoch-ms timestamp. */
function toEpoch(dateStr: string, timeStr: string): number | null {
  const dm = dateStr.trim().split(/[.\-/]/);
  if (dm.length !== 3) return null;
  const [y, mo, d] = dm.map(Number);
  const tm = timeStr.trim().split(':');
  if (tm.length < 2) return null;
  const [hh, mm] = tm.map(Number);
  const ss = tm.length > 2 ? Number(tm[2]) : 0; // may include ".mmm"; truncated to the second
  if ([y, mo, d, hh, mm, ss].some((n) => !Number.isFinite(n))) return null;
  return Date.UTC(y, mo - 1, d, hh, mm, Math.floor(ss));
}

/**
 * Build a per-row timestamp reader for whichever layout the file uses: separate
 * DATE + TIME columns, or a single combined DATETIME / TIMESTAMP column. Returns
 * null when neither layout is present so the caller can reject with a clear error.
 */
function makeTimestampAccessor(col: Record<string, number>): TimestampAccessor | null {
  if (col.DATE !== undefined && col.TIME !== undefined) {
    return (cells) => toEpoch(cells[col.DATE], cells[col.TIME]);
  }
  const dtIdx = col.DATETIME ?? col.TIMESTAMP;
  if (dtIdx !== undefined) {
    return (cells) => {
      const parts = (cells[dtIdx] ?? '').trim().split(/\s+/);
      return parts.length >= 2 ? toEpoch(parts[0], parts[1]) : null;
    };
  }
  return null;
}

/** Median of an array (non-mutating). */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Derive a symbol name from a filename like `XAUUSD_M1_202401.csv` → `XAUUSD`. */
function symbolFromFilename(filename?: string): string {
  if (!filename) return 'UNKNOWN';
  const base = filename.replace(/\.[^.]+$/, ''); // drop extension
  const first = base.split(/[_\s.-]/)[0];
  return first ? first.toUpperCase() : 'UNKNOWN';
}

export function parseMt5(text: string, filename?: string): Dataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd());
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length < 2) {
    throw new ParseError('The file is empty or has no data rows.');
  }

  const delimiter = detectDelimiter(nonEmpty[0]);
  const header = nonEmpty[0].split(delimiter).map(normHeader);

  // A real MT5 export always has a header row; require one so column mapping is safe.
  const hasHeader = header.some((c) => HEADER_KEYS.includes(c));
  if (!hasHeader) {
    throw new ParseError(
      'Column `<CLOSE>` not found. Export from MT5 via Chart → right-click → Save As, keeping the default columns.',
    );
  }

  const col: Record<string, number> = {};
  header.forEach((name, i) => {
    if (col[name] === undefined) col[name] = i;
  });

  // Every variant needs a timestamp: either separate DATE + TIME, or a single
  // combined DATETIME / TIMESTAMP column ("YYYY.MM.DD HH:MM:SS.mmm").
  const tsOf = makeTimestampAccessor(col);
  if (!tsOf) {
    throw new ParseError(
      'Column `<DATE>`/`<TIME>` not found. Export from MT5 keeping the default columns.',
    );
  }

  // Tick exports carry BID/ASK and no OHLC; bar exports carry OPEN…CLOSE.
  const isTick = col.BID !== undefined && (col.OPEN === undefined || col.CLOSE === undefined);

  if (isTick) {
    return parseTicks(text, filename, nonEmpty, delimiter, col, tsOf);
  }
  return parseBars(text, filename, nonEmpty, delimiter, col, tsOf);
}

/** Parse M1 bar rows (the canonical MT5 chart export). */
function parseBars(
  text: string,
  filename: string | undefined,
  rows: string[],
  delimiter: string,
  col: Record<string, number>,
  tsOf: TimestampAccessor,
): Dataset {
  for (const required of ['OPEN', 'HIGH', 'LOW', 'CLOSE'] as const) {
    if (col[required] === undefined) {
      throw new ParseError(
        `Column \`<${required}>\` not found. Export from MT5 via Chart → right-click → Save As, keeping the default columns.`,
      );
    }
  }

  const candles: Candle[] = [];
  let rowsDropped = 0;
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].split(delimiter);
    const t = tsOf(cells);
    const o = Number(cells[col.OPEN]);
    const h = Number(cells[col.HIGH]);
    const l = Number(cells[col.LOW]);
    const c = Number(cells[col.CLOSE]);
    if (t === null || [o, h, l, c].some((n) => !Number.isFinite(n))) {
      rowsDropped++;
      continue;
    }
    candles.push({ t, o, h, l, c });
  }

  if (candles.length < 2) {
    throw new ParseError('Not enough valid data rows to run a backtest.');
  }
  candles.sort((a, b) => a.t - b.t);

  const { medianSeconds, gaps } = analyseGaps(candles);
  if (Math.abs(medianSeconds - M1_SECONDS) > M1_TOLERANCE) {
    throw new ParseError(
      'TimeWindow requires M1 (1-minute) data. Export your chart as M1 and re-import.',
    );
  }

  return {
    id: hash(text),
    symbol: symbolFromFilename(filename),
    candles,
    importReport: buildReport(candles, medianSeconds, gaps, { rowsDropped, sourceType: 'bars' }),
  };
}

/** Parse a tick export and aggregate it into M1 candles using the Bid price. */
function parseTicks(
  text: string,
  filename: string | undefined,
  rows: string[],
  delimiter: string,
  col: Record<string, number>,
  tsOf: TimestampAccessor,
): Dataset {
  const stats = { count: 0, dropped: 0 };
  const candles = aggregateTicksToM1(iterTicks(rows, delimiter, col, tsOf, stats));

  if (candles.length < 2) {
    throw new ParseError('Not enough valid tick rows to build M1 bars.');
  }
  // Bars are M1 by construction here, so there is no median-gap check to fail;
  // minutes with no ticks are simply absent and the backtest skips them.
  const { medianSeconds, gaps } = analyseGaps(candles);

  return {
    id: hash(text),
    symbol: symbolFromFilename(filename),
    candles,
    importReport: buildReport(candles, medianSeconds, gaps, {
      rowsDropped: stats.dropped,
      sourceType: 'ticks',
      tickCount: stats.count,
      priceBasis: 'bid',
    }),
  };
}

/**
 * Stream ticks into M1 OHLC candles using the Bid price (matching how MT5 builds
 * its own M1 bars). Consumes a lazy iterator so the full tick set is never held
 * in memory. Assumes chronological input (MT5 tick exports are ascending).
 */
export function aggregateTicksToM1(ticks: Iterable<{ t: number; bid: number }>): Candle[] {
  const out: Candle[] = [];
  let curMin = -1;
  let o = 0;
  let h = 0;
  let l = 0;
  let c = 0;
  for (const { t, bid } of ticks) {
    const min = Math.floor(t / 60000) * 60000;
    if (min !== curMin) {
      if (curMin >= 0) out.push({ t: curMin, o, h, l, c });
      curMin = min;
      o = h = l = c = bid;
    } else {
      if (bid > h) h = bid;
      if (bid < l) l = bid;
      c = bid;
    }
  }
  if (curMin >= 0) out.push({ t: curMin, o, h, l, c });
  return out;
}

/** Lazily yield `{ t, bid }` per tick row, falling back to LAST/ASK when Bid is absent. */
function* iterTicks(
  rows: string[],
  delimiter: string,
  col: Record<string, number>,
  tsOf: TimestampAccessor,
  stats: { count: number; dropped: number },
): Iterable<{ t: number; bid: number }> {
  const bidIdx = col.BID ?? -1;
  const askIdx = col.ASK ?? -1;
  const lastIdx = col.LAST ?? -1;
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].split(delimiter);
    const t = tsOf(cells);
    let bid = bidIdx >= 0 ? Number(cells[bidIdx]) : NaN;
    if (!Number.isFinite(bid)) {
      const last = lastIdx >= 0 ? Number(cells[lastIdx]) : NaN;
      const ask = askIdx >= 0 ? Number(cells[askIdx]) : NaN;
      bid = Number.isFinite(last) ? last : ask;
    }
    if (t === null || !Number.isFinite(bid)) {
      stats.dropped++;
      continue;
    }
    stats.count++;
    yield { t, bid };
  }
}

/** Median intra-week bar gap (seconds) + flagged intra-week gaps (weekends excluded). */
function analyseGaps(candles: Candle[]): { medianSeconds: number; gaps: DataGap[] } {
  const intradayGaps: number[] = [];
  const gaps: DataGap[] = [];
  for (let i = 1; i < candles.length; i++) {
    const dtMs = candles[i].t - candles[i - 1].t;
    if (dtMs <= 0) continue;
    const prevDow = new Date(candles[i - 1].t).getUTCDay(); // 5 = Friday
    const isWeekendGap = prevDow === 5 && dtMs > WEEKEND_MS;
    if (dtMs < 12 * 60 * 60 * 1000) intradayGaps.push(dtMs);
    if (!isWeekendGap && dtMs > INTRAWEEK_GAP_MS) {
      gaps.push({ from: candles[i - 1].t, to: candles[i].t, minutes: dtMs / 60000 });
    }
  }
  return { medianSeconds: median(intradayGaps) / 1000, gaps };
}

/** Assemble the shared ImportReport from analysed candles + source metadata. */
function buildReport(
  candles: Candle[],
  medianSeconds: number,
  gaps: DataGap[],
  extra: Pick<ImportReport, 'rowsDropped' | 'sourceType'> &
    Partial<Pick<ImportReport, 'tickCount' | 'priceBasis'>>,
): ImportReport {
  return {
    rowsParsed: candles.length,
    dateRange: { start: new Date(candles[0].t), end: new Date(candles[candles.length - 1].t) },
    timeframe: 'M1',
    barGapSeconds: Math.round(medianSeconds),
    gaps,
    ...extra,
  };
}
