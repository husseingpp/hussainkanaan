import { formatLBP, formatUSD, usdCentsToLbp } from './lib/money';

// Demo-only rate (whole LBP per 1 USD). The real value comes from exchange_rates.
const DEMO_RATE = 89000;

// A couple of sample products priced canonically in USD cents.
const SAMPLE_ITEMS = [
  { name: 'Paracetamol 500mg (20 tab)', priceUsdCents: 150 },
  { name: 'Amoxicillin 500mg (16 cap)', priceUsdCents: 480 },
  { name: 'Insulin pen (refill)', priceUsdCents: 1250 },
];

export default function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">PharmaPOS</h1>
          <p className="mt-1 text-slate-500">
            Offline-first pharmacy POS for Lebanon · Phase 0 (Foundations)
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Dual-currency price preview</h2>
            <span className="text-sm text-slate-500">
              rate {DEMO_RATE.toLocaleString()} LBP / USD
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {SAMPLE_ITEMS.map((item) => (
              <li key={item.name} className="flex items-center justify-between py-3">
                <span className="text-sm">{item.name}</span>
                <span className="text-right text-sm">
                  <span className="font-medium">{formatUSD(item.priceUsdCents)}</span>
                  <span className="ml-2 text-slate-500">
                    {formatLBP(usdCentsToLbp(item.priceUsdCents, DEMO_RATE))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-6 text-sm text-slate-500">
          All amounts above are computed through <code>src/lib/money.ts</code> — the single source
          of truth for money math. The checkout screen lands in Phase 1.
        </p>
      </div>
    </main>
  );
}
