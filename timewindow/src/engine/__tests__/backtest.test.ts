import { describe, expect, it } from 'vitest';
import { backtestWindow } from '../backtest';
import { TimeWindow } from '../types';
import { ALL_DAYS, candle, dataset } from './fixtures';

function win(overrides: Partial<TimeWindow>): TimeWindow {
  return {
    entryHour: 9,
    entryMin: 0,
    exitHour: 17,
    exitMin: 0,
    positionSize: 1,
    contractSize: 100_000,
    filterDaysOfWeek: ALL_DAYS,
    ...overrides,
  };
}

describe('backtestWindow', () => {
  it('computes same-day P&L from entry close to exit open', () => {
    // 2026.06.30 is a Tuesday.
    const ds = dataset([
      candle('2026.06.30', '09:00', 0, { c: 2000 }),
      candle('2026.06.30', '17:00', 0, { o: 2010 }),
    ]);
    const { trades } = backtestWindow(ds, win({}));
    expect(trades).toHaveLength(1);
    expect(trades[0].entryPrice).toBe(2000);
    expect(trades[0].exitPrice).toBe(2010);
    expect(trades[0].pnl).toBe((2010 - 2000) * 1 * 100_000);
  });

  it('handles a midnight-crossing window (entry 23:57 → exit 01:00 next day)', () => {
    const ds = dataset([
      candle('2026.06.30', '23:57', 0, { c: 2000 }), // Tue entry
      candle('2026.07.01', '01:00', 0, { o: 2005 }), // Wed exit
    ]);
    const w = win({ entryHour: 23, entryMin: 57, exitHour: 1, exitMin: 0 });
    const { trades } = backtestWindow(ds, w);
    expect(trades).toHaveLength(1);
    expect(trades[0].date.getUTCDate()).toBe(30); // trade is dated to the entry day
    expect(trades[0].pnl).toBe((2005 - 2000) * 1 * 100_000);
  });

  it('skips a day when the entry or exit candle is missing', () => {
    const ds = dataset([
      candle('2026.06.30', '09:00', 0, { c: 2000 }),
      // no 17:00 exit candle
      candle('2026.06.30', '18:00', 0, { o: 2010 }),
    ]);
    const { trades, skippedDays } = backtestWindow(ds, win({}));
    expect(trades).toHaveLength(0);
    expect(skippedDays).toBe(1);
  });

  it('excludes days filtered out by the day-of-week filter', () => {
    // Mon 2026.06.29 and Tue 2026.06.30; keep Tuesday only.
    const ds = dataset([
      candle('2026.06.29', '09:00', 0, { c: 2000 }),
      candle('2026.06.29', '17:00', 0, { o: 2010 }),
      candle('2026.06.30', '09:00', 0, { c: 2000 }),
      candle('2026.06.30', '17:00', 0, { o: 2020 }),
    ]);
    const tuesdayOnly = [false, true, false, false, false, false, false];
    const { trades } = backtestWindow(ds, win({ filterDaysOfWeek: tuesdayOnly }));
    expect(trades).toHaveLength(1);
    expect(trades[0].date.getUTCDate()).toBe(30);
  });

  it('respects the date range filter', () => {
    const ds = dataset([
      candle('2026.06.29', '09:00', 0, { c: 2000 }),
      candle('2026.06.29', '17:00', 0, { o: 2010 }),
      candle('2026.06.30', '09:00', 0, { c: 2000 }),
      candle('2026.06.30', '17:00', 0, { o: 2010 }),
    ]);
    const w = win({
      dateRangeStart: new Date(Date.UTC(2026, 5, 30)),
      dateRangeEnd: new Date(Date.UTC(2026, 5, 30)),
    });
    const { trades } = backtestWindow(ds, w);
    expect(trades).toHaveLength(1);
    expect(trades[0].date.getUTCDate()).toBe(30);
  });

  it('scales P&L linearly with position size (0.01 lot = 1/100 of 1 lot)', () => {
    const ds = dataset([
      candle('2026.06.30', '09:00', 0, { c: 2000 }),
      candle('2026.06.30', '17:00', 0, { o: 2010 }),
    ]);
    const one = backtestWindow(ds, win({ positionSize: 1 })).trades[0].pnl;
    const micro = backtestWindow(ds, win({ positionSize: 0.01 })).trades[0].pnl;
    expect(micro).toBeCloseTo(one / 100, 6);
  });

  it('produces no trades across a weekend gap', () => {
    // Only Saturday candles exist; Sat/Sun excluded by default filter → no trades.
    const ds = dataset([
      candle('2026.06.27', '09:00', 0, { c: 2000 }), // Saturday
      candle('2026.06.27', '17:00', 0, { o: 2010 }),
    ]);
    const weekdaysOnly = [true, true, true, true, true, false, false];
    const { trades, evaluatedDays } = backtestWindow(ds, win({ filterDaysOfWeek: weekdaysOnly }));
    expect(trades).toHaveLength(0);
    expect(evaluatedDays).toBe(0);
  });

  it('yields a negative P&L when the exit is below the entry', () => {
    const ds = dataset([
      candle('2026.06.30', '09:00', 0, { c: 2010 }),
      candle('2026.06.30', '17:00', 0, { o: 2000 }),
    ]);
    const { trades } = backtestWindow(ds, win({}));
    expect(trades[0].pnl).toBeLessThan(0);
    expect(trades[0].pnl).toBe((2000 - 2010) * 1 * 100_000);
  });

  it('defaults the contract size to 100,000 when omitted', () => {
    const ds = dataset([
      candle('2026.06.30', '09:00', 0, { c: 2000 }),
      candle('2026.06.30', '17:00', 0, { o: 2001 }),
    ]);
    const w = win({});
    delete w.contractSize;
    const { trades } = backtestWindow(ds, w);
    expect(trades[0].pnl).toBe(1 * 1 * 100_000);
  });
});
