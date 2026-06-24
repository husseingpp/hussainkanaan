import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRepository, useSession } from '../../data/RepositoryProvider';
import type { NewSaleInput, NewSaleLineInput } from '../../data/repository';
import { computeTotals, type TotalsLine } from '../../data/saleAssembly';
import type { Product } from '../../data/types';
import { computeChange, lbpToUsdCents, settle, type PaymentInput } from '../../lib/money';
import { useCartStore } from '../../state/cartStore';
import { Cart } from './Cart';
import { Money } from './Money';
import { PaymentPanel } from './PaymentPanel';
import { ProductSearch } from './ProductSearch';
import { ReceiptPreview, type ReceiptModel } from './ReceiptPreview';
import { TotalsPanel } from './TotalsPanel';

const toTotalsLine = (l: {
  product: Product;
  qty: number;
  lineDiscountUsdCents: number;
}): TotalsLine => ({
  qty: l.qty,
  unit_price_usd_cents: l.product.price_usd_cents,
  line_discount_usd_cents: l.lineDiscountUsdCents,
  vat_rate: l.product.vat_rate,
});

export default function Checkout() {
  const repo = useRepository();
  const session = useSession();

  const lines = useCartStore((s) => s.lines);
  const wholeDiscount = useCartStore((s) => s.wholeDiscountUsdCents);
  const payments = useCartStore((s) => s.payments);
  const addProduct = useCartStore((s) => s.addProduct);
  const reset = useCartStore((s) => s.reset);

  const [rate, setRate] = useState<number | null>(null);
  const [roundingStep, setRoundingStep] = useState(1000);
  const [storeName, setStoreName] = useState('PharmaPOS');
  const [receipt, setReceipt] = useState<ReceiptModel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const current = await repo.exchangeRates.current();
      setRate(current?.usd_to_lbp ?? null);
      const step = await repo.settings.get('ll_rounding_step');
      if (step) setRoundingStep(Number(step));
      const name = await repo.settings.get('store_name');
      if (name) setStoreName(name);
    })();
  }, [repo]);

  const totals = useMemo(
    () => computeTotals(lines.map(toTotalsLine), wholeDiscount),
    [lines, wholeDiscount],
  );

  const handlePick = useCallback(
    async (product: Product) => {
      const batches = await repo.batches.listByProduct(product.id);
      const batch = batches.find((b) => b.qty_on_hand > 0) ?? batches[0];
      if (!batch) {
        setError(`${product.name} has no stock batch.`);
        return;
      }
      setError(null);
      addProduct(product, batch.id);
    },
    [repo, addProduct],
  );

  const onComplete = useCallback(async () => {
    if (!rate || lines.length === 0) return;
    const paymentInputs: PaymentInput[] = payments.map((p) => ({
      currency: p.currency,
      amountMinor: p.amount_minor,
    }));
    if (!settle(paymentInputs, totals.total_usd_cents, rate).settled) return;

    const change = computeChange(paymentInputs, totals.total_usd_cents, rate, roundingStep);
    const saleLines: NewSaleLineInput[] = lines.map((l) => ({
      product_id: l.product.id,
      batch_id: l.batchId,
      qty: l.qty,
      unit_price_usd_cents: l.product.price_usd_cents,
      line_discount_usd_cents: l.lineDiscountUsdCents,
      vat_rate: l.product.vat_rate,
    }));
    const input: NewSaleInput = {
      branch_id: session.branchId,
      user_id: session.userId,
      customer_id: null,
      lines: saleLines,
      payments,
      discount_usd_cents: wholeDiscount,
      exchange_rate: rate,
      ll_rounding_cents: lbpToUsdCents(change.roundingLbp, rate),
      prescription_ref: null,
    };

    setBusy(true);
    setError(null);
    try {
      const sale = await repo.sales.createCompleted(input);
      setReceipt({
        storeName,
        sale,
        rate,
        payments: [...payments],
        change,
        lines: lines.map((l, i) => ({
          name: `${l.product.name} ${l.product.strength ?? ''}`.trim(),
          qty: l.qty,
          unitPriceUsdCents: l.product.price_usd_cents,
          lineTotalUsdCents: totals.lineTotals[i],
        })),
      });
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [rate, lines, payments, totals, roundingStep, wholeDiscount, repo, session, storeName, reset]);

  if (rate === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        No exchange rate set. Configure one in the admin screen (Phase 5).
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-bold">{storeName}</h1>
          <p className="text-xs text-slate-400">Checkout</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">
            1&nbsp;USD = {rate.toLocaleString()}&nbsp;L.L.
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            ● Offline · local SQLite
          </span>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[1fr_380px]">
        <section className="flex min-h-0 flex-col gap-4">
          <div className="min-h-0 flex-1">
            <ProductSearch rate={rate} onPick={handlePick} />
          </div>
          <div className="flex min-h-0 flex-[1.2] flex-col">
            <h2 className="mb-2 text-sm font-semibold text-slate-600">Cart</h2>
            <Cart rate={rate} />
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <TotalsPanel totals={totals} rate={rate} />
          <PaymentPanel
            totalUsdCents={totals.total_usd_cents}
            rate={rate}
            roundingStep={roundingStep}
            busy={busy}
            error={error}
            onComplete={onComplete}
          />
          <p className="px-1 text-center text-xs text-slate-400">
            Totals shown as <Money usd={totals.total_usd_cents} rate={rate} /> — every figure flows
            through <code>money.ts</code>.
          </p>
        </aside>
      </div>

      {receipt && <ReceiptPreview receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
