import type { BacktestStats } from '@/engine';
import { fmtDateUTC, fmtMoney, fmtPct } from '@/lib/format';

function Stat({
  label,
  value,
  tone = 'default',
  big = false,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'gold' | 'win' | 'loss';
  big?: boolean;
}) {
  const toneClass =
    tone === 'gold'
      ? 'text-floor-gold'
      : tone === 'win'
        ? 'text-trade-win'
        : tone === 'loss'
          ? 'text-trade-loss'
          : 'text-text-primary';
  return (
    <div className="rounded-lg border border-floor-border bg-floor-bg p-3">
      <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">{label}</div>
      <div className={`num font-semibold ${big ? 'text-2xl' : 'text-lg'} ${toneClass}`}>{value}</div>
    </div>
  );
}

export function StatsCard({ stats }: { stats: BacktestStats }) {
  const totalTone = stats.totalPnl > 0 ? 'win' : stats.totalPnl < 0 ? 'loss' : 'default';

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <Stat label="Win %" value={fmtPct(stats.winRate)} tone="gold" big />
      <Stat label="Total P&L" value={fmtMoney(stats.totalPnl)} tone={totalTone} big />
      <Stat label="Trades" value={String(stats.totalTrades)} />
      <Stat label="Expectancy / trade" value={fmtMoney(stats.expectancy)} />
      <Stat label="Avg win" value={fmtMoney(stats.avgWin)} tone="win" />
      <Stat label="Avg loss" value={fmtMoney(-stats.avgLoss)} tone="loss" />
      <Stat label="Median P&L" value={fmtMoney(stats.medianPnl)} />
      <Stat label="Max drawdown" value={fmtMoney(-stats.largestDrawdown)} tone="loss" />
      <Stat
        label="Best day ✓"
        value={stats.bestDay ? `${fmtMoney(stats.bestDay.pnl)} · ${fmtDateUTC(stats.bestDay.date)}` : '—'}
        tone="win"
      />
      <Stat
        label="Worst day ✗"
        value={stats.worstDay ? `${fmtMoney(stats.worstDay.pnl)} · ${fmtDateUTC(stats.worstDay.date)}` : '—'}
        tone="loss"
      />
      <Stat label="Winners" value={String(stats.winningTrades)} tone="win" />
      <Stat label="Losers" value={String(stats.losingTrades)} tone="loss" />
    </section>
  );
}
