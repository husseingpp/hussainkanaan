/**
 * Expiry report — every in-stock batch bucketed by expiry (expired / expiring / ok),
 * with quantity and retail valuation. The "gate" report for Phase 2.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRepository } from '../../data/RepositoryProvider';
import type { ExpiryBucket, ExpiryRow } from '../../data/repository';
import { Money } from '../Checkout/Money';
import { todayIso } from '../../lib/dates';

const BUCKETS: { id: ExpiryBucket; label: string; tone: string }[] = [
  { id: 'expired', label: 'Expired', tone: 'text-red-700' },
  { id: 'expiring', label: 'Expiring soon', tone: 'text-amber-700' },
  { id: 'ok', label: 'OK', tone: 'text-emerald-700' },
];

export function ExpiryReport() {
  const repo = useRepository();
  const [rows, setRows] = useState<ExpiryRow[]>([]);
  const [rate, setRate] = useState<number | null>(null);
  const [nearDays, setNearDays] = useState(90);

  useEffect(() => {
    (async () => {
      const days = Number((await repo.settings.get('near_expiry_days')) ?? '90');
      setNearDays(days);
      setRate((await repo.exchangeRates.current())?.usd_to_lbp ?? null);
      setRows(await repo.inventory.expiryReport(todayIso(), days));
    })();
  }, [repo]);

  const byBucket = useMemo(() => {
    const map: Record<ExpiryBucket, ExpiryRow[]> = { expired: [], expiring: [], ok: [] };
    for (const r of rows) map[r.bucket].push(r);
    return map;
  }, [rows]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-lg font-bold">Expiry report</h2>
        <p className="mt-1 text-sm text-slate-500">
          As of {todayIso()} · near-expiry window {nearDays} days.
        </p>

        <div className="mt-6 space-y-6">
          {BUCKETS.map((bucket) => {
            const items = byBucket[bucket.id];
            if (items.length === 0) return null;
            const retail = items.reduce(
              (s, r) => s + r.batch.qty_on_hand * r.product.price_usd_cents,
              0,
            );
            return (
              <section key={bucket.id}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className={`text-sm font-semibold ${bucket.tone}`}>
                    {bucket.label} ({items.length})
                  </h3>
                  {rate && (
                    <span className="text-xs text-slate-500">
                      Retail value: <Money usd={retail} rate={rate} />
                    </span>
                  )}
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-2 font-medium">Product</th>
                        <th className="px-4 py-2 font-medium">Batch</th>
                        <th className="px-4 py-2 font-medium">Expiry</th>
                        <th className="px-4 py-2 text-right font-medium">Qty</th>
                        <th className="px-4 py-2 text-right font-medium">Retail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((r) => (
                        <tr key={r.batch.id}>
                          <td className="px-4 py-2.5">
                            <span className="font-medium text-slate-800">{r.product.name}</span>{' '}
                            <span className="text-slate-400">{r.product.strength}</span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500">{r.batch.batch_no ?? '—'}</td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {r.batch.expiry_date ?? 'no expiry'}
                            {r.days_to_expiry !== null && (
                              <span className="ml-1 text-xs text-slate-400">
                                ({r.days_to_expiry < 0 ? `${-r.days_to_expiry}d ago` : `in ${r.days_to_expiry}d`})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {r.batch.qty_on_hand}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {rate && (
                              <Money
                                usd={r.batch.qty_on_hand * r.product.price_usd_cents}
                                rate={rate}
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
          {rows.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              No in-stock batches to report.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
