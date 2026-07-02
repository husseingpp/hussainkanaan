/**
 * P&L calculator — pure function over a dataset + a time window.
 *
 * For each calendar day D that passes the filters:
 *   entryPrice = close of the M1 candle at D · entryHour:entryMin
 *   exitPrice  = open  of the M1 candle at the exit time. If the exit time is at
 *                or before the entry time within a day, the exit is on D+1
 *                (the blueprint's 23:57 → 01:00 midnight-crossing case).
 *   pnl        = (exitPrice − entryPrice) × positionSize × contractSize
 * Missing entry or exit candle → skip the day (counted in `skippedDays`).
 */

import { BacktestResult, Candle, DailyTrade, Dataset, DEFAULT_CONTRACT_SIZE, TimeWindow } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC midnight epoch for the calendar day containing `t`. */
function utcMidnight(t: number): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Map a JS UTC day (0=Sun..6=Sat) to the Mon-first index used by the filter. */
function monFirstIndex(t: number): number {
  return (new Date(t).getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
}

export function backtestWindow(dataset: Dataset, window: TimeWindow): BacktestResult {
  const contractSize = window.contractSize ?? DEFAULT_CONTRACT_SIZE;
  const byTimestamp = new Map<number, Candle>();
  for (const candle of dataset.candles) byTimestamp.set(candle.t, candle);

  const entryMinutes = window.entryHour * 60 + window.entryMin;
  const exitMinutes = window.exitHour * 60 + window.exitMin;
  const crossesMidnight = exitMinutes <= entryMinutes;

  const rangeStart = window.dateRangeStart ? utcMidnight(window.dateRangeStart.getTime()) : -Infinity;
  const rangeEnd = window.dateRangeEnd ? utcMidnight(window.dateRangeEnd.getTime()) : Infinity;

  const firstDay = utcMidnight(dataset.candles[0].t);
  const lastDay = utcMidnight(dataset.candles[dataset.candles.length - 1].t);

  const trades: DailyTrade[] = [];
  let skippedDays = 0;
  let evaluatedDays = 0;

  for (let day = firstDay; day <= lastDay; day += DAY_MS) {
    if (day < rangeStart || day > rangeEnd) continue;
    if (!window.filterDaysOfWeek[monFirstIndex(day)]) continue;

    evaluatedDays++;

    const entryTs = day + entryMinutes * 60 * 1000;
    const exitBaseDay = crossesMidnight ? day + DAY_MS : day;
    const exitTs = exitBaseDay + exitMinutes * 60 * 1000;

    const entryCandle = byTimestamp.get(entryTs);
    const exitCandle = byTimestamp.get(exitTs);
    if (!entryCandle || !exitCandle) {
      skippedDays++;
      continue;
    }

    const entryPrice = entryCandle.c;
    const exitPrice = exitCandle.o;
    const pnl = (exitPrice - entryPrice) * window.positionSize * contractSize;
    trades.push({ date: new Date(day), entryPrice, exitPrice, pnl });
  }

  return { trades, skippedDays, evaluatedDays };
}
