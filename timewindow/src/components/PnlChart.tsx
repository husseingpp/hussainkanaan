import { useMemo } from 'react';
import {
  Bar,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyTrade } from '@/engine';
import { tokens } from '@/tokens';
import { fmtDateUTC, fmtMoney } from '@/lib/format';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

export interface ChartRow {
  i: number;
  label: string;
  pnl: number;
  equity: number;
}

export function toChartRows(trades: DailyTrade[]): ChartRow[] {
  let equity = 0;
  return trades.map((t, i) => {
    equity += t.pnl;
    return { i, label: fmtDateUTC(t.date), pnl: t.pnl, equity };
  });
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="num rounded-md border border-floor-border bg-floor-panel px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-text-dim">{row.label}</div>
      <div style={{ color: row.pnl >= 0 ? tokens.trade.win : tokens.trade.loss }}>
        P&L {fmtMoney(row.pnl)}
      </div>
      <div style={{ color: tokens.trade.curve }}>Equity {fmtMoney(row.equity)}</div>
    </div>
  );
}

export function PnlChart({
  rows,
  selected,
  onSelect,
  onHover,
}: {
  rows: ChartRow[];
  selected: number | null;
  onSelect: (i: number | null) => void;
  onHover: (i: number | null) => void;
}) {
  const reduce = usePrefersReducedMotion();
  const bars = useMemo(() => rows, [rows]);

  if (rows.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-text-dim">
        No trades for the current filters.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart
        data={bars}
        margin={{ top: 10, right: 12, bottom: 4, left: 4 }}
        onMouseMove={(state) => onHover(typeof state.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null)}
        onMouseLeave={() => onHover(null)}
        onClick={(state) =>
          onSelect(typeof state.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null)
        }
      >
        <XAxis dataKey="label" hide />
        {/* Left axis: daily P&L bars. Right axis: cumulative equity curve —
            separate scales so the bars stay readable next to a large equity total. */}
        <YAxis
          yAxisId="pnl"
          tick={{ fill: tokens.text.dim, fontSize: 11 }}
          tickFormatter={(v) => fmtMoney(v)}
          width={72}
          stroke={tokens.floor.border}
        />
        <YAxis
          yAxisId="equity"
          orientation="right"
          tick={{ fill: tokens.trade.curve, fontSize: 11 }}
          tickFormatter={(v) => fmtMoney(v)}
          width={72}
          stroke={tokens.floor.border}
        />
        <ReferenceLine yAxisId="pnl" y={0} stroke={tokens.floor.border} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar
          yAxisId="pnl"
          dataKey="pnl"
          isAnimationActive={!reduce}
          className={reduce ? undefined : 'bar-rise'}
          maxBarSize={18}
        >
          {bars.map((row) => (
            <Cell
              key={row.i}
              fill={row.pnl >= 0 ? tokens.trade.win : tokens.trade.loss}
              stroke={selected === row.i ? tokens.floor.gold : undefined}
              strokeWidth={selected === row.i ? 2 : 0}
            />
          ))}
        </Bar>
        <Line
          yAxisId="equity"
          type="monotone"
          dataKey="equity"
          stroke={tokens.trade.curve}
          strokeWidth={2}
          dot={false}
          isAnimationActive={!reduce}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
