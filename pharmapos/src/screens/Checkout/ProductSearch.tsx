import { useMemo, useState } from 'react';
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

export function ProductSearch({
  products,
  rate,
  onHandOf,
  onPick,
}: {
  products: Product[];
  rate: number;
  onHandOf: (productId: string) => number;
  onPick: (p: Product) => void;
}) {
  const [query, setQuery] = useState('');

  const results = useMemo(
    () => (query.trim() === '' ? products : products.filter((p) => matches(p, query.trim()))),
    [products, query],
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
        {results.map((p) => {
          const onHand = onHandOf(p.id);
          const out = onHand <= 0;
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={out}
                onClick={() => onPick(p)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {p.name} {p.strength}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {p.generic_name} · {p.form} ·{' '}
                    <span className={out ? 'text-red-500' : 'text-slate-400'}>
                      {out ? 'out of stock' : `${onHand} in stock`}
                    </span>
                  </span>
                </span>
                <Money usd={p.price_usd_cents} rate={rate} className="shrink-0 text-sm" />
              </button>
            </li>
          );
        })}
        {results.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-400">No products found.</li>
        )}
      </ul>
    </div>
  );
}
