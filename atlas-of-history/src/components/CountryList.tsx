import { useMemo } from 'react';
import { Fact } from '../data/sampleFacts';

interface CountryListProps {
  facts: Fact[];
  query: string;
  onQueryChange: (q: string) => void;
  onSelectCountry: (countryCode: string) => void;
}

interface CountryRow {
  code: string;
  name: string;
  count: number;
}

export function CountryList({ facts, query, onQueryChange, onSelectCountry }: CountryListProps) {
  const countries = useMemo<CountryRow[]>(() => {
    const map = new Map<string, CountryRow>();
    for (const f of facts) {
      const existing = map.get(f.country_code);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(f.country_code, { code: f.country_code, name: f.country_name, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [facts]);

  return (
    <div>
      <label className="sr-only" htmlFor="country-search">
        Search facts and countries
      </label>
      <input
        id="country-search"
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search facts or countries"
        className="w-full bg-slate-800 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 mb-4"
      />

      {countries.length === 0 ? (
        <p className="text-sm text-slate-500">
          {query.trim() ? 'No facts match your search.' : 'No facts yet. Click a country to add one.'}
        </p>
      ) : (
        <ul className="space-y-1">
          {countries.map((c) => (
            <li key={c.code}>
              <button
                onClick={() => onSelectCountry(c.code)}
                className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded hover:bg-slate-800 transition-colors group"
              >
                <span className="text-sm text-slate-200 group-hover:text-white truncate">
                  {c.name}
                </span>
                <span className="shrink-0 text-xs text-slate-400 bg-slate-800 group-hover:bg-slate-700 rounded-full px-2 py-0.5">
                  {c.count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
