import { describe, expect, it } from 'vitest';
import { aggregateTicksToM1, parseMt5 } from '../parser';
import { backtestWindow } from '../backtest';
import { ParseError, type TimeWindow } from '../types';
import { ALL_DAYS, candle, dataset } from './fixtures';

/** Build a tab-separated MT5 tick export (DATE TIME BID ASK LAST VOLUME FLAGS). */
function tickExport(rows: string[], brackets = true): string {
  const header = brackets
    ? '<DATE>\t<TIME>\t<BID>\t<ASK>\t<LAST>\t<VOLUME>\t<FLAGS>'
    : 'DATE\tTIME\tBID\tASK\tLAST\tVOLUME\tFLAGS';
  return [header, ...rows].join('\n');
}

function tick(date: string, time: string, bid: number, ask = bid + 0.2): string {
  return `${date}\t${time}\t${bid}\t${ask}\t0\t1\t6`;
}

describe('aggregateTicksToM1', () => {
  it('builds Bid OHLC from several ticks in one minute (first/max/min/last)', () => {
    const base = Date.UTC(2026, 5, 30, 14, 5);
    const bars = aggregateTicksToM1([
      { t: base + 1000, bid: 2000 },
      { t: base + 2000, bid: 2004 },
      { t: base + 3000, bid: 1998 },
      { t: base + 4000, bid: 2001 },
    ]);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ t: base, o: 2000, h: 2004, l: 1998, c: 2001 });
  });

  it('splits ticks into separate candles on the minute boundary', () => {
    const m5 = Date.UTC(2026, 5, 30, 14, 5, 59); // :59
    const m6 = Date.UTC(2026, 5, 30, 14, 6, 0); // next minute
    const bars = aggregateTicksToM1([
      { t: m5, bid: 2000 },
      { t: m6, bid: 2010 },
    ]);
    expect(bars).toHaveLength(2);
    expect(bars[0].t).toBe(Date.UTC(2026, 5, 30, 14, 5));
    expect(bars[1].t).toBe(Date.UTC(2026, 5, 30, 14, 6));
  });
});

describe('parseMt5 (tick input)', () => {
  it('detects a tick export and aggregates it into M1 bars', () => {
    const ds = parseMt5(
      tickExport([
        tick('2026.06.30', '14:05:01.100', 2000),
        tick('2026.06.30', '14:05:30.500', 2005),
        tick('2026.06.30', '14:05:59.900', 2002),
        tick('2026.06.30', '14:06:10.000', 2003),
      ]),
      'XAUUSD_ticks.csv',
    );
    expect(ds.importReport.sourceType).toBe('ticks');
    expect(ds.importReport.priceBasis).toBe('bid');
    expect(ds.importReport.tickCount).toBe(4);
    expect(ds.candles).toHaveLength(2);
    // First minute: open 2000, high 2005, low 2000, close 2002.
    expect(ds.candles[0]).toMatchObject({ o: 2000, h: 2005, l: 2000, c: 2002 });
  });

  it('does NOT reject tick data as non-M1 (bars are M1 by construction)', () => {
    // Sub-second ticks would fail the bar M1 median-gap check; the tick path skips it.
    expect(() =>
      parseMt5(
        tickExport([
          tick('2026.06.30', '14:05:01.000', 2000),
          tick('2026.06.30', '14:05:02.000', 2001),
          tick('2026.06.30', '14:06:01.000', 2002),
        ]),
      ),
    ).not.toThrow();
  });

  it('parses a combined DATETIME column with milliseconds', () => {
    const header = '<DATETIME>\t<BID>\t<ASK>\t<LAST>\t<VOLUME>';
    const rows = [
      '2026.06.30 14:05:01.100\t2000\t2000.2\t0\t1',
      '2026.06.30 14:05:40.900\t2006\t2006.2\t0\t1',
      '2026.06.30 14:06:00.000\t2007\t2007.2\t0\t1',
    ];
    const ds = parseMt5([header, ...rows].join('\n'));
    expect(ds.importReport.sourceType).toBe('ticks');
    expect(ds.candles).toHaveLength(2);
    expect(ds.candles[0]).toMatchObject({ o: 2000, h: 2006, l: 2000, c: 2006 });
  });

  it('drops malformed tick rows and counts the rest', () => {
    const ds = parseMt5(
      tickExport([
        tick('2026.06.30', '14:05:01', 2000),
        'garbage\trow\tno\tnumbers\tx\ty\tz',
        tick('2026.06.30', '14:06:01', 2001),
      ]),
    );
    expect(ds.importReport.tickCount).toBe(2);
    expect(ds.importReport.rowsDropped).toBe(1);
  });

  it('still rejects a bar export that is not M1', () => {
    const header = '<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>';
    const rows = [
      '2026.06.30\t14:05:00\t1\t1\t1\t1\t1',
      '2026.06.30\t14:10:00\t1\t1\t1\t1\t1',
      '2026.06.30\t14:15:00\t1\t1\t1\t1\t1',
    ];
    expect(() => parseMt5([header, ...rows].join('\n'))).toThrow(ParseError);
    expect(() => parseMt5([header, ...rows].join('\n'))).toThrow(/M1/);
  });

  it('is equivalent to the matching bar import for a backtest', () => {
    // Ticks: entry minute 09:00 closes at 2000 (last bid), exit minute 17:00 opens at 2010 (first bid).
    const tickDs = parseMt5(
      tickExport([
        tick('2026.06.30', '09:00:05', 1998),
        tick('2026.06.30', '09:00:55', 2000), // last bid of 09:00 → entry close
        tick('2026.06.30', '17:00:03', 2010), // first bid of 17:00 → exit open
        tick('2026.06.30', '17:00:40', 2012),
      ]),
    );
    // Equivalent M1 bars built directly (the parser's M1 check needs contiguous
    // minutes, which a 2-bar fixture isn't — the aggregation logic is what we compare).
    const barDs = dataset([
      candle('2026.06.30', '09:00', 0, { o: 1998, h: 2000, l: 1998, c: 2000 }),
      candle('2026.06.30', '17:00', 0, { o: 2010, h: 2012, l: 2010, c: 2012 }),
    ]);
    const window: TimeWindow = {
      entryHour: 9,
      entryMin: 0,
      exitHour: 17,
      exitMin: 0,
      positionSize: 1,
      contractSize: 100_000,
      filterDaysOfWeek: ALL_DAYS,
    };
    const fromTicks = backtestWindow(tickDs, window).trades;
    const fromBars = backtestWindow(barDs, window).trades;
    expect(fromTicks).toHaveLength(1);
    expect(fromTicks[0].entryPrice).toBe(2000);
    expect(fromTicks[0].exitPrice).toBe(2010);
    expect(fromTicks[0].pnl).toBe(fromBars[0].pnl);
  });
});
