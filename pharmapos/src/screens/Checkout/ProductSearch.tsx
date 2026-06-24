import { useEffect, useMemo, useState } from 'react';
import { useRepository } from '../../data/RepositoryProvider';
import type { Product } from '../../data/types';
import { Money } from './Money';

function matches(p: Product, q: string): boolean {
  const needle = q.toLowerCase();
  return (
    p.name.toLowerCase().includes(needle) ||
    (p.generic_name ?? '').toLowerCase().includes(needle) ||
    (p.brand ?? '').toLowerCase().includes(needle) ||
    (p.barcode ?? '').includes(q)
  );
}

export function ProductSearch({ rate, onPick }: { rate: number; onPick: (p: Product) => void }) {
  const repo = useRepository();
  const [all, setAll] = useState<Product[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    repo.products.list().then(setAll);
  }, [repo]);

  const results = useMemo(
    () => (query.trim() === '' ? all : all.filter((p) => matches(p, query.trim()))),
    [all, query],
  );

  return (
    <div className="flex h-full flex-col">
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Scan barcode or search by name / generic / brand…"
        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
      <ul className="mt-3 flex-1 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
        {results.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-emerald-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800">
                  {p.name} {p.strength}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {p.generic_name} · {p.form}
                </span>
              </span>
              <Money usd={p.price_usd_cents} rate={rate} className="shrink-0 text-sm" />
            </button>
          </li>
        ))}
        {results.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-400">No products found.</li>
        )}
      </ul>
    </div>
  );
}
