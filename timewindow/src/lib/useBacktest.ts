import { useMemo } from 'react';
import { backtestWindow, calcAccount, calcStats } from '@/engine';
import { useStore } from '@/store/useStore';

/** Derived backtest + stats + account, recomputed when dataset/window/balance change. */
export function useBacktest() {
  const dataset = useStore((s) => s.dataset);
  const window = useStore((s) => s.window);
  const accountBalance = useStore((s) => s.accountBalance);

  return useMemo(() => {
    if (!dataset) return null;
    const result = backtestWindow(dataset, window);
    const stats = calcStats(result.trades);
    const account = calcAccount(result.trades, accountBalance);
    return { ...result, stats, account };
  }, [dataset, window, accountBalance]);
}
