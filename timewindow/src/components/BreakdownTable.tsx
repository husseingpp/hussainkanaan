import { useEffect, useRef } from 'react';
import type { DailyTrade } from '@/engine';
import { fmtDateUTC, fmtMoney, fmtPrice } from '@/lib/format';

/** Trigger a CSV download of the daily breakdown. */
function exportCsv(trades: DailyTrade[]) {
  const header = 'Date,Entry,Exit,PnL';
  const lines = trades.map(
    (t) => `${fmtDateUTC(t.date)},${t.entryPrice},${t.exitPrice},${t.pnl.toFixed(2)}`,
  );
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'timewindow-breakdown.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function BreakdownTable({
  trades,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  trades: DailyTrade[];
  selected: number | null;
  hovered: number | null;
  onSelect: (i: number | null) => void;
  onHover: (i: number | null) => void;
}) {
  const selectedRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-xs uppercase tracking-wide text-text-dim">Daily breakdown</span>
        <button
          type="button"
          onClick={() => exportCsv(trades)}
          disabled={trades.length === 0}
          className="rounded-md border border-floor-border px-2 py-1 text-xs text-text-primary hover:border-floor-gold disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>
      <div className="max-h-80 overflow-auto rounded-lg border border-floor-border">
        <table className="num w-full text-sm">
          <thead className="sticky top-0 bg-floor-panel text-text-dim">
            <tr className="text-right">
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Entry</th>
              <th className="px-3 py-2 font-medium">Exit</th>
              <th className="px-3 py-2 font-medium">P&L</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => {
              const active = selected === i || hovered === i;
              return (
                <tr
                  key={i}
                  ref={selected === i ? selectedRef : undefined}
                  onMouseEnter={() => onHover(i)}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => onSelect(selected === i ? null : i)}
                  className={`cursor-pointer text-right transition-colors ${
                    active ? 'bg-floor-gold/10' : 'hover:bg-white/5'
                  }`}
                >
                  <td className="px-3 py-1.5 text-left text-text-dim">{fmtDateUTC(t.date)}</td>
                  <td className="px-3 py-1.5">{fmtPrice(t.entryPrice)}</td>
                  <td className="px-3 py-1.5">{fmtPrice(t.exitPrice)}</td>
                  <td
                    className={`px-3 py-1.5 font-medium ${
                      t.pnl >= 0 ? 'text-trade-win' : 'text-trade-loss'
                    }`}
                  >
                    {fmtMoney(t.pnl)}
                  </td>
                </tr>
              );
            })}
            {trades.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-text-dim">
                  No trades for the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
