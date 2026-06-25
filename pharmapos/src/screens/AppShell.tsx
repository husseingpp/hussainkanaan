/**
 * Top-level app chrome: a slim nav across the Phase 1/2 screens plus the store name,
 * current rate, an offline badge, and a low-stock/near-expiry alert count. Screens are
 * swapped by local state (no router dependency needed yet).
 */

import { useCallback, useEffect, useState } from 'react';
import { useRepository } from '../data/RepositoryProvider';
import { todayIso } from '../lib/dates';
import Checkout from './Checkout/Checkout';
import { GoodsReceived } from './GoodsReceived/GoodsReceived';
import { InventoryAlerts } from './Inventory/InventoryAlerts';
import { ExpiryReport } from './Reports/ExpiryReport';

type Tab = 'checkout' | 'goods' | 'inventory' | 'expiry';

const TABS: { id: Tab; label: string }[] = [
  { id: 'checkout', label: 'Checkout' },
  { id: 'goods', label: 'Goods Received' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'expiry', label: 'Expiry Report' },
];

export function AppShell() {
  const repo = useRepository();
  const [tab, setTab] = useState<Tab>('checkout');
  const [storeName, setStoreName] = useState('PharmaPOS');
  const [rate, setRate] = useState<number | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      setStoreName((await repo.settings.get('store_name')) ?? 'PharmaPOS');
      setRate((await repo.exchangeRates.current())?.usd_to_lbp ?? null);
      const nearDays = Number((await repo.settings.get('near_expiry_days')) ?? '90');
      const lowThreshold = Number((await repo.settings.get('low_stock_threshold')) ?? '10');
      const [low, expiry] = await Promise.all([
        repo.inventory.lowStock(lowThreshold),
        repo.inventory.expiryReport(todayIso(), nearDays),
      ]);
      setAlertCount(low.length + expiry.filter((r) => r.bucket !== 'ok').length);
    })();
  }, [repo, refreshKey]);

  const onStockChanged = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-2.5">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-base font-bold leading-tight">{storeName}</h1>
            <p className="text-[11px] text-slate-400">PharmaPOS</p>
          </div>
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  tab === t.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label}
                {(t.id === 'inventory' || t.id === 'expiry') && alertCount > 0 && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 text-[10px] font-bold ${
                      tab === t.id ? 'bg-white/25 text-white' : 'bg-amber-400 text-white'
                    }`}
                  >
                    {alertCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {rate && <span className="text-slate-500">1 USD = {rate.toLocaleString()} L.L.</span>}
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            ● Offline · local SQLite
          </span>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === 'checkout' && <Checkout onStockChanged={onStockChanged} />}
        {tab === 'goods' && <GoodsReceived onReceived={onStockChanged} />}
        {tab === 'inventory' && <InventoryAlerts onChanged={onStockChanged} />}
        {tab === 'expiry' && <ExpiryReport />}
      </main>
    </div>
  );
}
