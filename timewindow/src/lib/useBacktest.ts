import { useMemo } from 'react';
import { backtestWindow, calcStats } from '@/engine';
import { useStore } from '@/store/useStore';

/** Derived backtest + stats, recomputed whenever the dataset or window changes. */
export function useBacktest() {
  const dataset = useStore((s) => s.dataset);
  const window = useStore((s) => s.window);

  return useMemo(() => {
    if (!dataset) return null;
    const result = backtestWindow(dataset, window);
    const stats = calcStats(result.trades);
    return { ...result, stats };
  }, [dataset, window]);
}
