import { useMemo, useState } from 'react';
import { BreakdownTable } from '@/components/BreakdownTable';
import { ControlPanel } from '@/components/ControlPanel';
import { Dropzone } from '@/components/Dropzone';
import { ImportReport } from '@/components/ImportReport';
import { PnlChart, toChartRows } from '@/components/PnlChart';
import { StatsCard } from '@/components/StatsCard';
import { TopBar } from '@/components/TopBar';
import { useBacktest } from '@/lib/useBacktest';
import { useStore } from '@/store/useStore';

export default function App() {
  const dataset = useStore((s) => s.dataset);
  const backtest = useBacktest();
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const rows = useMemo(() => (backtest ? toChartRows(backtest.trades) : []), [backtest]);

  if (!dataset || !backtest) return <Dropzone />;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="border-b border-floor-border bg-floor-panel lg:w-72 lg:border-b-0 lg:border-r">
          <ControlPanel skippedDays={backtest.skippedDays} />
        </aside>

        <main className="flex-1 space-y-4 p-4">
          <ImportReport report={dataset.importReport} />
          <StatsCard stats={backtest.stats} />

          <section className="rounded-lg border border-floor-border bg-floor-panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-primary">Daily P&L · equity curve</h2>
              <span className="num text-xs text-text-dim">
                {backtest.trades.length} trades · {backtest.skippedDays} skipped
              </span>
            </div>
            <PnlChart
              rows={rows}
              selected={selected}
              onSelect={setSelected}
              onHover={setHovered}
            />
          </section>

          <section className="rounded-lg border border-floor-border bg-floor-panel p-4">
            <BreakdownTable
              trades={backtest.trades}
              selected={selected}
              hovered={hovered}
              onSelect={setSelected}
              onHover={setHovered}
            />
          </section>
        </main>
      </div>
    </div>
  );
}
