/**
 * Stats calculator — pure function over the daily trades.
 * Winners: pnl > 0. Losers: pnl < 0. Break-even (pnl === 0) trades count toward
 * the total but are neither win nor loss.
 */

import { BacktestStats, DailyTrade } from './types';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const EMPTY: BacktestStats = {
  totalTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  winRate: 0,
  avgWin: 0,
  avgLoss: 0,
  medianPnl: 0,
  bestDay: null,
  worstDay: null,
  totalPnl: 0,
  largestDrawdown: 0,
  expectancy: 0,
};

export function calcStats(trades: DailyTrade[]): BacktestStats {
  if (trades.length === 0) return { ...EMPTY };

  const winners = trades.filter((t) => t.pnl > 0);
  const losers = trades.filter((t) => t.pnl < 0);

  const winSum = winners.reduce((s, t) => s + t.pnl, 0);
  const lossSum = losers.reduce((s, t) => s + t.pnl, 0); // negative

  const avgWin = winners.length ? winSum / winners.length : 0;
  const avgLoss = losers.length ? Math.abs(lossSum) / losers.length : 0;

  const winFraction = winners.length / trades.length;
  const expectancy = avgWin * winFraction - avgLoss * (1 - winFraction);

  // Largest peak-to-trough drawdown of the cumulative equity curve.
  let equity = 0;
  let peak = 0;
  let largestDrawdown = 0;
  let best = trades[0];
  let worst = trades[0];
  for (const t of trades) {
    equity += t.pnl;
    if (equity > peak) peak = equity;
    largestDrawdown = Math.max(largestDrawdown, peak - equity);
    if (t.pnl > best.pnl) best = t;
    if (t.pnl < worst.pnl) worst = t;
  }

  return {
    totalTrades: trades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRate: winFraction * 100,
    avgWin,
    avgLoss,
    medianPnl: median(trades.map((t) => t.pnl)),
    bestDay: { date: best.date, pnl: best.pnl },
    worstDay: { date: worst.date, pnl: worst.pnl },
    totalPnl: equity,
    largestDrawdown,
    expectancy,
  };
}
