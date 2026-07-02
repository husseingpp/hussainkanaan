/**
 * Core domain types for the TimeWindow backtester.
 * All timestamps are epoch-ms built from broker-server wall-clock time via
 * `Date.UTC` — we never convert timezones (see CLAUDE.md, deliberate non-goal).
 * Always read the clock back with the `getUTC*` accessors.
 */

export interface Candle {
  t: number; // epoch ms (broker server time, treated as naive/UTC)
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
}

/** A gap in intra-week data (weekend gaps are expected and NOT reported here). */
export interface DataGap {
  from: number; // epoch ms of the candle before the gap
  to: number; // epoch ms of the candle after the gap
  minutes: number; // gap length in minutes
}

export interface ImportReport {
  rowsParsed: number;
  rowsDropped: number;
  dateRange: { start: Date; end: Date };
  timeframe: string; // always "M1" in v1 (non-M1 is rejected before this)
  barGapSeconds: number; // median gap between consecutive bars
  gaps: DataGap[]; // intra-week gaps flagged as errors
}

export interface Dataset {
  id: string; // hash of the file contents
  symbol: string;
  candles: Candle[]; // ascending M1 bars, no gaps except weekends
  importReport: ImportReport;
}

export interface TimeWindow {
  entryHour: number;
  entryMin: number;
  exitHour: number;
  exitMin: number;
  positionSize: number; // MT5 lots, e.g. 0.01
  contractSize?: number; // units per lot; default 100_000 (see blueprint §9.5)
  filterDaysOfWeek: boolean[]; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]; true = include
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
}

export interface DailyTrade {
  date: Date; // the calendar day of entry (UTC midnight)
  entryPrice: number; // close of the entry candle
  exitPrice: number; // open of the exit candle
  pnl: number; // (exit - entry) × positionSize × contractSize
}

export interface BacktestResult {
  trades: DailyTrade[];
  skippedDays: number; // days evaluated but skipped (missing entry/exit candle)
  evaluatedDays: number; // days that passed the day-of-week + date-range filters
}

export interface BacktestStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // percentage, 0–100
  avgWin: number; // average P&L of winners
  avgLoss: number; // average P&L of losers, as an absolute value
  medianPnl: number;
  bestDay: { date: Date; pnl: number } | null;
  worstDay: { date: Date; pnl: number } | null;
  totalPnl: number;
  largestDrawdown: number; // peak-to-trough of the equity curve (positive)
  expectancy: number; // (avgWin × winFraction) − (avgLoss × lossFraction)
}

/** Default contract size for XAUUSD per the blueprint P&L formula (§9.5). */
export const DEFAULT_CONTRACT_SIZE = 100_000;

/** Thrown by the parser for user-fixable input problems. `message` is UI-ready. */
export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}
