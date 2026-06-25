/**
 * Goods Received — add stock into the system. Picks a product, captures batch no /
 * expiry / quantity / unit cost, and calls inventory.receiveStock (which writes a
 * `purchase` stock movement and tops up / creates the batch).
 */

import { useEffect, useState } from 'react';
import { useRepository, useSession } from '../../data/RepositoryProvider';
import { parseUSD } from '../../lib/money';
import type { Product } from '../../data/types';

export function GoodsReceived({ onReceived }: { onReceived?: () => void }) {
  const repo = useRepository();
  const session = useSession();

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [expiry, setExpiry] = useState('');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    repo.products.list().then((p) => {
      setProducts(p);
      if (p.length && !productId) setProductId(p[0].id);
    });
  }, [repo, productId]);

  const submit = async () => {
    setError(null);
    setMessage(null);
    const quantity = Math.floor(Number(qty));
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      setError('Pick a product and enter a quantity greater than zero.');
      return;
    }
    let costCents = 0;
    if (cost.trim() !== '') {
      try {
        costCents = parseUSD(cost);
      } catch {
        setError('Unit cost must be a dollar amount, e.g. 8.50');
        return;
      }
    }

    setBusy(true);
    try {
      const batch = await repo.inventory.receiveStock({
        product_id: productId,
        branch_id: session.branchId,
        batch_no: batchNo.trim() === '' ? null : batchNo.trim(),
        expiry_date: expiry === '' ? null : expiry,
        qty: quantity,
        cost_usd_cents: costCents,
        user_id: session.userId,
      });
      const product = products.find((p) => p.id === productId);
      setMessage(
        `Received ${quantity} × ${product?.name ?? 'item'} — batch now holds ${batch.qty_on_hand}.`,
      );
      setBatchNo('');
      setExpiry('');
      setQty('');
      setCost('');
      onReceived?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-xl">
        <h2 className="text-lg font-bold">Goods Received</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add incoming stock. This records a purchase movement and updates the batch.
        </p>

        <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <Field label="Product">
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.strength} — {p.generic_name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Batch no.">
              <input
                type="text"
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
                placeholder="optional"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </Field>
            <Field label="Expiry date">
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </Field>
            <Field label="Quantity">
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </Field>
            <Field label="Unit cost ($)">
              <input
                type="text"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </Field>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}

          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {busy ? 'Receiving…' : 'Receive stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
