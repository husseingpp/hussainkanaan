/**
 * Inventory alerts: products running low on stock and batches at/near expiry.
 * Expired batches can be written off inline (a negative `adjustment` movement).
 */

import { useCallback, useEffect, useState } from 'react';
import { useRepository, useSession } from '../../data/RepositoryProvider';
import type { ExpiryRow, LowStockRow } from '../../data/repository';
import { todayIso } from '../../lib/dates';

export function InventoryAlerts({ onChanged }: { onChanged?: () => void }) {
  const repo = useRepository();
  const session = useSession();
  const [low, setLow] = useState<LowStockRow[]>([]);
  const [expiry, setExpiry] = useState<ExpiryRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const nearDays = Number((await repo.settings.get('near_expiry_days')) ?? '90');
    const threshold = Number((await repo.settings.get('low_stock_threshold')) ?? '10');
    const [lowRows, expiryRows] = await Promise.all([
      repo.inventory.lowStock(threshold),
      repo.inventory.expiryReport(todayIso(), nearDays),
    ]);
    setLow(lowRows);
    setExpiry(expiryRows.filter((r) => r.bucket !== 'ok'));
  }, [repo]);

  useEffect(() => {
    load();
  }, [load]);

  const writeOff = async (row: ExpiryRow) => {
    setBusyId(row.batch.id);
    try {
      await repo.inventory.adjustStock(row.batch.id, -row.batch.qty_on_hand, session.userId);
      await load();
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-8">
        <section>
          <h2 className="text-lg font-bold">Low stock</h2>
          <p className="mt-1 text-sm text-slate-500">Products at or below the reorder threshold.</p>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {low.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Nothing low. 🎉</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {low.map((r) => (
                    <tr key={r.product.id}>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-slate-800">{r.product.name}</span>{' '}
                        <span className="text-slate-400">{r.product.strength}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          {r.on_hand} on hand
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold">Expiring &amp; expired batches</h2>
          <p className="mt-1 text-sm text-slate-500">
            Within the near-expiry window, or already past expiry.
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {expiry.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No batches at risk.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">Product</th>
                    <th className="px-4 py-2 font-medium">Batch</th>
                    <th className="px-4 py-2 font-medium">Expiry</th>
                    <th className="px-4 py-2 text-right font-medium">Qty</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expiry.map((r) => (
                    <tr key={r.batch.id}>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{r.product.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{r.batch.batch_no ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            r.bucket === 'expired'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {r.batch.expiry_date}
                          {r.days_to_expiry !== null &&
                            ` · ${r.days_to_expiry < 0 ? `${-r.days_to_expiry}d ago` : `${r.days_to_expiry}d`}`}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.batch.qty_on_hand}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.bucket === 'expired' && (
                          <button
                            type="button"
                            disabled={busyId === r.batch.id}
                            onClick={() => writeOff(r)}
                            className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Write off
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
