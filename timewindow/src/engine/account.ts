/**
 * Account model — layers a real starting balance over the daily trades.
 * Pure function: walks the equity curve from `startingBalance`, tracking return,
 * drawdown, and the first day the balance would have hit zero (blow-up).
 */

import { AccountResult, DailyTrade } from './types';

export function calcAccount(trades: DailyTrade[], startingBalance: number): AccountResult {
  let balance = startingBalance;
  let peak = startingBalance;
  let lowest = startingBalance;
  let maxDrawdownPct = 0;
  let blownDate: Date | null = null;

  for (const t of trades) {
    balance += t.pnl;
    if (balance <= 0 && blownDate === null) blownDate = t.date;
    if (balance > peak) peak = balance;
    if (balance < lowest) lowest = balance;
    if (peak > 0) {
      const ddPct = ((peak - balance) / peak) * 100;
      if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;
    }
  }

  return {
    startingBalance,
    endingBalance: balance,
    returnPct: startingBalance !== 0 ? ((balance - startingBalance) / startingBalance) * 100 : 0,
    peakBalance: peak,
    lowestBalance: lowest,
    maxDrawdownPct,
    blownDate,
  };
}
