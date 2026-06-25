import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRepository, useSession } from '../../data/RepositoryProvider';
import type { NewSaleInput, NewSaleLineInput } from '../../data/repository';
import { computeTotals, type TotalsLine } from '../../data/saleAssembly';
import { availableQty, pickFefoBatch } from '../../data/fefo';
import type { Batch, Product } from '../../data/types';
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

export default function Checkout({ onStockChanged }: { onStockChanged?: () => void }) {
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
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<Map<string, { onHand: number; fefoBatch: Batch | null }>>(
    new Map(),
  );
  const [receipt, setReceipt] = useState<ReceiptModel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load (and refresh) products + per-product on-hand and the current FEFO batch.
  const loadStock = useCallback(async () => {
    const all = await repo.products.list();
    const map = new Map<string, { onHand: number; fefoBatch: Batch | null }>();
    await Promise.all(
      all.map(async (p) => {
        const batches = await repo.batches.listByProduct(p.id);
        map.set(p.id, { onHand: availableQty(batches), fefoBatch: pickFefoBatch(batches) });
      }),
    );
    setProducts(all);
    setStock(map);
  }, [repo]);

  useEffect(() => {
    (async () => {
      const current = await repo.exchangeRates.current();
      setRate(current?.usd_to_lbp ?? null);
      const step = await repo.settings.get('ll_rounding_step');
      if (step) setRoundingStep(Number(step));
      const name = await repo.settings.get('store_name');
      if (name) setStoreName(name);
      await loadStock();
    })();
  }, [repo, loadStock]);

  const totals = useMemo(
    () => computeTotals(lines.map(toTotalsLine), wholeDiscount),
    [lines, wholeDiscount],
  );

  const handlePick = useCallback(
    (product: Product) => {
      const batch = stock.get(product.id)?.fefoBatch;
      if (!batch) {
        setError(`${product.name} is out of stock.`);
        return;
      }
      setError(null);
      addProduct(product, batch);
    },
    [stock, addProduct],
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
      await loadStock(); // reflect the decremented stock
      onStockChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [rate, lines, payments, totals, roundingStep, wholeDiscount, repo, session, storeName, reset, loadStock, onStockChanged]);

  if (rate === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        No exchange rate set. Configure one in the admin screen (Phase 5).
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 text-slate-900">
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[1fr_380px]">
        <section className="flex min-h-0 flex-col gap-4">
          <div className="min-h-0 flex-1">
            <ProductSearch
              products={products}
              rate={rate}
              onHandOf={(id) => stock.get(id)?.onHand ?? 0}
              onPick={handlePick}
            />
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
