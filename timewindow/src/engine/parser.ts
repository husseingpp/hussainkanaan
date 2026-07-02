/**
 * MT5 export parser.
 *
 * Handles the three input variants from the blueprint (§3):
 *   A. tab-separated with angle-bracket headers (`<DATE>\t<TIME>\t...`)
 *   B. comma-separated, headers may lack angle brackets
 *   C. anything that isn't M1 → rejected with a clear message
 *
 * Dates are `YYYY.MM.DD` (also tolerates `-` / `/`) combined with `HH:MM[:SS]`
 * into a naive epoch-ms timestamp — no timezone conversion (broker server time).
 */

import { Candle, DataGap, Dataset, ImportReport, ParseError } from './types';

const M1_SECONDS = 60;
const M1_TOLERANCE = 5; // accept 55–65s median bar gap as M1
const WEEKEND_MS = 40 * 60 * 60 * 1000; // > this after a Friday bar = weekend, not a gap
const INTRAWEEK_GAP_MS = 5 * 60 * 1000; // flag intra-week gaps longer than 5 minutes

const REQUIRED_COLUMNS = ['DATE', 'TIME', 'OPEN', 'HIGH', 'LOW', 'CLOSE'] as const;

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
  const ss = tm.length > 2 ? Number(tm[2]) : 0;
  if ([y, mo, d, hh, mm, ss].some((n) => !Number.isFinite(n))) return null;
  return Date.UTC(y, mo - 1, d, hh, mm, ss);
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
  const hasHeader = header.some((c) => REQUIRED_COLUMNS.includes(c as never));
  if (!hasHeader) {
    throw new ParseError(
      'Column `<CLOSE>` not found. Export from MT5 via Chart → right-click → Save As, keeping the default columns.',
    );
  }

  const col: Record<string, number> = {};
  header.forEach((name, i) => {
    if (col[name] === undefined) col[name] = i;
  });
  for (const required of REQUIRED_COLUMNS) {
    if (col[required] === undefined) {
      throw new ParseError(
        `Column \`<${required}>\` not found. Export from MT5 via Chart → right-click → Save As, keeping the default columns.`,
      );
    }
  }

  const candles: Candle[] = [];
  let rowsDropped = 0;
  for (let i = 1; i < nonEmpty.length; i++) {
    const cells = nonEmpty[i].split(delimiter);
    const t = toEpoch(cells[col.DATE], cells[col.TIME]);
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

  // Timeframe detection from the median bar gap. Intra-week gaps only — weekend
  // gaps would skew the median, so we drop anything longer than a trading day.
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

  const medianSeconds = median(intradayGaps) / 1000;
  if (Math.abs(medianSeconds - M1_SECONDS) > M1_TOLERANCE) {
    throw new ParseError(
      'TimeWindow requires M1 (1-minute) data. Export your chart as M1 and re-import.',
    );
  }

  const report: ImportReport = {
    rowsParsed: candles.length,
    rowsDropped,
    dateRange: { start: new Date(candles[0].t), end: new Date(candles[candles.length - 1].t) },
    timeframe: 'M1',
    barGapSeconds: Math.round(medianSeconds),
    gaps,
  };

  return {
    id: hash(text),
    symbol: symbolFromFilename(filename),
    candles,
    importReport: report,
  };
}
