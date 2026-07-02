import { useState } from 'react';
import type { ImportReport as Report } from '@/engine';
import { fmtDateUTC } from '@/lib/format';

/** Compact import summary: rows parsed, span, timeframe, gaps flagged. */
export function ImportReport({ report }: { report: Report }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  const { rowsParsed, rowsDropped, dateRange, timeframe, gaps, sourceType, tickCount } = report;
  const days = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86_400_000);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-floor-border bg-floor-panel px-4 py-2 text-xs text-text-dim">
      <span className="num text-text-primary">{rowsParsed.toLocaleString()} bars</span>
      <span className="num">{timeframe}</span>
      {sourceType === 'ticks' && tickCount !== undefined && (
        <span className="num text-floor-gold">
          · aggregated {tickCount.toLocaleString()} ticks → M1 (Bid)
        </span>
      )}
      <span className="num">
        {fmtDateUTC(dateRange.start)} → {fmtDateUTC(dateRange.end)} ({days} days)
      </span>
      {rowsDropped > 0 && <span className="num">· {rowsDropped} rows dropped</span>}
      {gaps.length > 0 ? (
        <span className="text-floor-gold">· {gaps.length} intra-week gap{gaps.length > 1 ? 's' : ''} flagged</span>
      ) : (
        <span className="text-trade-win">· no intra-week gaps</span>
      )}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="ml-auto text-text-dim hover:text-text-primary"
        aria-label="Dismiss import report"
      >
        ✕
      </button>
    </div>
  );
}
