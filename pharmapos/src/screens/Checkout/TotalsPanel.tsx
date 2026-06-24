import { useState } from 'react';
import type { SaleTotals } from '../../data/saleAssembly';
import { parseUSD } from '../../lib/money';
import { useCartStore } from '../../state/cartStore';
import { Money } from './Money';

export function TotalsPanel({ totals, rate }: { totals: SaleTotals; rate: number }) {
  const setWholeDiscount = useCartStore((s) => s.setWholeDiscount);
  const [discountText, setDiscountText] = useState('');

  const applyDiscount = (text: string) => {
    setDiscountText(text);
    if (text.trim() === '') {
      setWholeDiscount(0);
      return;
    }
    try {
      setWholeDiscount(parseUSD(text));
    } catch {
      // keep the field text; ignore until it parses
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="space-y-1.5 text-sm">
        <Row label="Subtotal" usd={totals.subtotal_usd_cents} rate={rate} />
        <div className="flex items-center justify-between">
          <label className="text-slate-500" htmlFor="whole-discount">
            Discount ($)
          </label>
          <input
            id="whole-discount"
            type="text"
            inputMode="decimal"
            value={discountText}
            onChange={(e) => applyDiscount(e.target.value)}
            placeholder="0.00"
            className="w-24 rounded border border-slate-300 px-2 py-1 text-right outline-none focus:border-emerald-500"
          />
        </div>
        <Row label="of which VAT" usd={totals.vat_usd_cents} rate={rate} muted />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
        <span className="text-base font-semibold text-slate-800">Total</span>
        <Money
          usd={totals.total_usd_cents}
          rate={rate}
          emphasizeLbp
          className="text-base font-semibold"
        />
      </div>
    </div>
  );
}

function Row({
  label,
  usd,
  rate,
  muted,
}: {
  label: string;
  usd: number;
  rate: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-xs text-slate-400' : 'text-slate-500'}>{label}</span>
      <Money usd={usd} rate={rate} className={muted ? 'text-xs' : ''} />
    </div>
  );
}
