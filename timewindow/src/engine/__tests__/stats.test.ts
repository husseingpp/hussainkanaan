import { describe, expect, it } from 'vitest';
import { calcStats } from '../stats';
import { DailyTrade } from '../types';

function trade(day: number, pnl: number): DailyTrade {
  return {
    date: new Date(Date.UTC(2026, 0, day)),
    entryPrice: 2000,
    exitPrice: 2000 + pnl,
    pnl,
  };
}

describe('calcStats', () => {
  it('returns zeroed stats for no trades', () => {
    const s = calcStats([]);
    expect(s.totalTrades).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.bestDay).toBeNull();
    expect(s.worstDay).toBeNull();
  });

  it('counts winners, losers and win rate as a percentage', () => {
    const s = calcStats([trade(1, 100), trade(2, -50), trade(3, 200), trade(4, -25)]);
    expect(s.totalTrades).toBe(4);
    expect(s.winningTrades).toBe(2);
    expect(s.losingTrades).toBe(2);
    expect(s.winRate).toBe(50);
  });

  it('computes avg win and avg loss (loss as an absolute value)', () => {
    const s = calcStats([trade(1, 100), trade(2, 200), trade(3, -60)]);
    expect(s.avgWin).toBe(150);
    expect(s.avgLoss).toBe(60);
  });

  it('computes expectancy = avgWin×winFraction − avgLoss×lossFraction', () => {
    const s = calcStats([trade(1, 100), trade(2, 200), trade(3, -60), trade(4, -60)]);
    // avgWin 150, avgLoss 60, winFraction 0.5 → 150*0.5 - 60*0.5 = 45
    expect(s.expectancy).toBeCloseTo(45, 6);
  });

  it('computes total P&L and the best / worst day', () => {
    const s = calcStats([trade(1, 100), trade(2, -50), trade(3, 200)]);
    expect(s.totalPnl).toBe(250);
    expect(s.bestDay?.pnl).toBe(200);
    expect(s.worstDay?.pnl).toBe(-50);
    expect(s.bestDay?.date.getUTCDate()).toBe(3);
  });

  it('computes the median P&L', () => {
    const s = calcStats([trade(1, 10), trade(2, 30), trade(3, 20)]);
    expect(s.medianPnl).toBe(20);
  });

  it('computes the largest peak-to-trough drawdown of the equity curve', () => {
    // equity: +100, +300, +100, +400 → peak 300 then dip to 100 = drawdown 200.
    const s = calcStats([trade(1, 100), trade(2, 200), trade(3, -200), trade(4, 300)]);
    expect(s.largestDrawdown).toBe(200);
  });
});
