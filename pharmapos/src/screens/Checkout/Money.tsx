import { formatLBP, formatUSD, usdCentsToLbp } from '../../lib/money';

/** Render a canonical USD-cents amount in both currencies: "$12.50 · 1,112,500 L.L." */
export function Money({
  usd,
  rate,
  className,
  emphasizeLbp,
}: {
  usd: number;
  rate: number;
  className?: string;
  emphasizeLbp?: boolean;
}) {
  return (
    <span className={className}>
      <span className="tabular-nums">{formatUSD(usd)}</span>
      <span className="px-1 text-slate-300">·</span>
      <span className={`tabular-nums ${emphasizeLbp ? 'text-slate-700' : 'text-slate-500'}`}>
        {formatLBP(usdCentsToLbp(usd, rate))}
      </span>
    </span>
  );
}
