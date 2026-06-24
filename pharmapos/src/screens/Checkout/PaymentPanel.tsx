import { useState } from 'react';
import type { PaymentCurrency, PaymentMethod } from '../../data/types';
import {
  computeChange,
  formatLBP,
  parseMoney,
  settle,
  sumPaymentsUsdCents,
  usdCentsToLbp,
  type PaymentInput,
} from '../../lib/money';
import { useCartStore } from '../../state/cartStore';
import { Money } from './Money';

export function PaymentPanel({
  totalUsdCents,
  rate,
  roundingStep,
  busy,
  error,
  onComplete,
}: {
  totalUsdCents: number;
  rate: number;
  roundingStep: number;
  busy: boolean;
  error: string | null;
  onComplete: () => void;
}) {
  const payments = useCartStore((s) => s.payments);
  const addPayment = useCartStore((s) => s.addPayment);
  const removePayment = useCartStore((s) => s.removePayment);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<PaymentCurrency>('USD');
  const [method, setMethod] = useState<PaymentMethod>('cash');

  const paymentInputs: PaymentInput[] = payments.map((p) => ({
    currency: p.currency,
    amountMinor: p.amount_minor,
  }));
  const paid = sumPaymentsUsdCents(paymentInputs, rate);
  const settlement = settle(paymentInputs, totalUsdCents, rate);
  const change = computeChange(paymentInputs, totalUsdCents, rate, roundingStep);
  const remainingUsd = Math.max(0, totalUsdCents - paid);

  const add = () => {
    try {
      const amountMinor = parseMoney(amount, currency);
      if (amountMinor <= 0) return;
      addPayment({ currency, amount_minor: amountMinor, method });
      setAmount('');
    } catch {
      // ignore unparseable input
    }
  };

  const payExact = (cur: PaymentCurrency) => {
    if (remainingUsd <= 0) return;
    const amountMinor = cur === 'USD' ? remainingUsd : usdCentsToLbp(remainingUsd, rate);
    addPayment({ currency: cur, amount_minor: amountMinor, method });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Payment</h3>

      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Amount"
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as PaymentCurrency)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
        >
          <option value="USD">$</option>
          <option value="LBP">L.L.</option>
        </select>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
        >
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="credit">Credit</option>
        </select>
        <button
          type="button"
          onClick={add}
          className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Add
        </button>
      </div>

      <div className="mt-2 flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => payExact('USD')}
          className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
        >
          Exact $
        </button>
        <button
          type="button"
          onClick={() => payExact('LBP')}
          className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
        >
          Exact L.L.
        </button>
      </div>

      {payments.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {payments.map((p, i) => (
            <li key={i} className="flex items-center justify-between">
              <span className="text-slate-600">
                {p.method} ·{' '}
                {p.currency === 'USD'
                  ? `$${(p.amount_minor / 100).toFixed(2)}`
                  : formatLBP(p.amount_minor)}
              </span>
              <button
                type="button"
                onClick={() => removePayment(i)}
                className="text-slate-300 hover:text-red-500"
                aria-label="Remove payment"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Paid</dt>
          <dd>
            <Money usd={paid} rate={rate} />
          </dd>
        </div>
        {settlement.settled ? (
          <div className="flex justify-between">
            <dt className="text-slate-500">Change (L.L.)</dt>
            <dd className="font-medium text-emerald-700">
              {formatLBP(change.roundedChangeLbp)}
              {change.roundingLbp !== 0 && (
                <span className="ml-1 text-xs text-slate-400">
                  (rounding {change.roundingLbp > 0 ? '+' : ''}
                  {formatLBP(change.roundingLbp)})
                </span>
              )}
            </dd>
          </div>
        ) : (
          <div className="flex justify-between">
            <dt className="text-slate-500">Balance due</dt>
            <dd className="font-medium text-amber-600">
              <Money usd={-settlement.balanceUsdCents} rate={rate} />
            </dd>
          </div>
        )}
      </dl>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        disabled={busy || totalUsdCents <= 0 || !settlement.settled}
        onClick={onComplete}
        className="mt-3 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
      >
        {busy ? 'Completing…' : 'Complete sale'}
      </button>
    </div>
  );
}
