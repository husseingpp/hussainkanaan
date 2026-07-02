import { describe, expect, it } from 'vitest';
import { parseMt5 } from '../parser';
import { ParseError } from '../types';

/** Build a tab-separated M1 export with angle-bracket headers. */
function tabExport(rows: string[], withBrackets = true): string {
  const header = withBrackets
    ? '<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\t<VOL>\t<SPREAD>'
    : 'DATE\tTIME\tOPEN\tHIGH\tLOW\tCLOSE\tTICKVOL\tVOL\tSPREAD';
  return [header, ...rows].join('\n');
}

/** Two consecutive M1 bars one minute apart. */
const TWO_M1 = [
  '2026.06.30\t14:05:00\t3312.45\t3313.10\t3311.80\t3312.90\t412\t0\t22',
  '2026.06.30\t14:06:00\t3312.90\t3313.50\t3312.10\t3313.00\t401\t0\t20',
];

describe('parseMt5', () => {
  it('parses tab-separated data with angle-bracket headers', () => {
    const ds = parseMt5(tabExport(TWO_M1), 'XAUUSD_M1.csv');
    expect(ds.candles).toHaveLength(2);
    expect(ds.candles[0]).toMatchObject({ o: 3312.45, h: 3313.1, l: 3311.8, c: 3312.9 });
  });

  it('parses comma-separated data without angle brackets', () => {
    const rows = TWO_M1.map((r) => r.replace(/\t/g, ','));
    const csv = ['DATE,TIME,OPEN,HIGH,LOW,CLOSE,TICKVOL,VOL,SPREAD', ...rows].join('\n');
    const ds = parseMt5(csv, 'xauusd.csv');
    expect(ds.candles).toHaveLength(2);
    expect(ds.candles[1].c).toBe(3313.0);
  });

  it('auto-detects the delimiter regardless of header bracket style', () => {
    const noBrackets = parseMt5(tabExport(TWO_M1, false));
    expect(noBrackets.candles).toHaveLength(2);
  });

  it('combines date + time into a naive (non-tz-shifted) epoch timestamp', () => {
    const ds = parseMt5(tabExport(TWO_M1));
    const d = new Date(ds.candles[0].t);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCHours()).toBe(14);
    expect(d.getUTCMinutes()).toBe(5);
  });

  it('rejects non-M1 data (5-minute bars) with the M1 message', () => {
    const rows = [
      '2026.06.30\t14:05:00\t1\t1\t1\t1\t1\t0\t1',
      '2026.06.30\t14:10:00\t1\t1\t1\t1\t1\t0\t1',
      '2026.06.30\t14:15:00\t1\t1\t1\t1\t1\t0\t1',
    ];
    expect(() => parseMt5(tabExport(rows))).toThrow(/M1/);
  });

  it('throws a column error when CLOSE is missing', () => {
    const header = '<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<TICKVOL>';
    const body = '2026.06.30\t14:05:00\t1\t1\t1\t99';
    expect(() => parseMt5([header, body].join('\n'))).toThrow(ParseError);
    expect(() => parseMt5([header, body].join('\n'))).toThrow(/CLOSE/);
  });

  it('drops malformed rows and counts them in the import report', () => {
    const rows = [...TWO_M1, 'garbage\trow\twith\tbad\tnumbers\tx\t\t\t', ''];
    const ds = parseMt5(tabExport(rows));
    expect(ds.candles).toHaveLength(2);
    expect(ds.importReport.rowsDropped).toBe(1);
  });

  it('derives the symbol from the filename', () => {
    const ds = parseMt5(tabExport(TWO_M1), 'XAUUSD_M1_202401_202606.csv');
    expect(ds.symbol).toBe('XAUUSD');
  });

  it('reports the correct date range', () => {
    const ds = parseMt5(tabExport(TWO_M1));
    expect(ds.importReport.dateRange.start.getUTCHours()).toBe(14);
    expect(ds.importReport.dateRange.end.getUTCMinutes()).toBe(6);
  });

  it('flags an intra-week gap but not a weekend gap', () => {
    // Fri 2026.06.26 23:59 → Mon 2026.06.29 00:00 is a weekend gap (OK);
    // Mon 00:00 → Mon 00:30 is an intra-week gap (flagged).
    const rows = [
      '2026.06.26\t23:58:00\t1\t1\t1\t1\t1\t0\t1',
      '2026.06.26\t23:59:00\t1\t1\t1\t1\t1\t0\t1',
      '2026.06.29\t00:00:00\t1\t1\t1\t1\t1\t0\t1',
      '2026.06.29\t00:01:00\t1\t1\t1\t1\t1\t0\t1',
      '2026.06.29\t00:31:00\t1\t1\t1\t1\t1\t0\t1',
    ];
    const ds = parseMt5(tabExport(rows));
    expect(ds.importReport.gaps).toHaveLength(1);
    expect(ds.importReport.gaps[0].minutes).toBe(30);
  });
});
