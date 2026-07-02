import { describe, expect, it } from 'vitest';
import { calcAccount } from '../account';
import { DailyTrade } from '../types';

function trade(day: number, pnl: number): DailyTrade {
  return { date: new Date(Date.UTC(2026, 0, day)), entryPrice: 2000, exitPrice: 2000 + pnl, pnl };
}

describe('calcAccount', () => {
  it('grows the balance and reports return %', () => {
    const a = calcAccount([trade(1, 20), trade(2, 30)], 200);
    expect(a.endingBalance).toBe(250);
    expect(a.returnPct).toBeCloseTo(25, 6); // (250-200)/200
    expect(a.blownDate).toBeNull();
  });

  it('reports a negative return on a losing run', () => {
    const a = calcAccount([trade(1, -10), trade(2, -30)], 200);
    expect(a.endingBalance).toBe(160);
    expect(a.returnPct).toBeCloseTo(-20, 6);
  });

  it('flags the exact day the account blows up (balance ≤ 0)', () => {
    // $50 start: -20 → 30, -40 → -10 (blown on day 2), +100 → 90 (still flagged).
    const a = calcAccount([trade(1, -20), trade(2, -40), trade(3, 100)], 50);
    expect(a.blownDate).not.toBeNull();
    expect(a.blownDate?.getUTCDate()).toBe(2);
  });

  it('does not flag a blow-up when the balance stays positive', () => {
    const a = calcAccount([trade(1, -20), trade(2, -20)], 100);
    expect(a.blownDate).toBeNull();
    expect(a.lowestBalance).toBe(60);
  });

  it('tracks peak balance and max drawdown %', () => {
    // 100 → 200 → 150 → 250. Peak ends at 250; the 200→150 dip = 25% drawdown.
    const a = calcAccount([trade(1, 100), trade(2, -50), trade(3, 100)], 100);
    expect(a.peakBalance).toBe(250);
    expect(a.maxDrawdownPct).toBeCloseTo(25, 6);
  });

  it('returns the starting balance unchanged for no trades', () => {
    const a = calcAccount([], 200);
    expect(a.endingBalance).toBe(200);
    expect(a.returnPct).toBe(0);
    expect(a.blownDate).toBeNull();
  });
});
