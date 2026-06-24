import { useCartStore } from '../../state/cartStore';
import { Money } from './Money';

export function Cart({ rate }: { rate: number }) {
  const lines = useCartStore((s) => s.lines);
  const setQty = useCartStore((s) => s.setQty);
  const removeLine = useCartStore((s) => s.removeLine);

  if (lines.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
        Cart is empty — pick a product to start a sale.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2 font-medium">Item</th>
            <th className="px-3 py-2 text-center font-medium">Qty</th>
            <th className="px-3 py-2 text-right font-medium">Line total</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.map((l) => {
            const lineTotal = l.qty * l.product.price_usd_cents - l.lineDiscountUsdCents;
            return (
              <tr key={l.product.id}>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">
                    {l.product.name} {l.product.strength}
                  </div>
                  <div className="text-xs text-slate-400">
                    <Money usd={l.product.price_usd_cents} rate={rate} /> each
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="number"
                    min={1}
                    value={l.qty}
                    onChange={(e) => setQty(l.product.id, Math.floor(Number(e.target.value)))}
                    className="w-16 rounded border border-slate-300 px-2 py-1 text-center outline-none focus:border-emerald-500"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money usd={lineTotal} rate={rate} />
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeLine(l.product.id)}
                    className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                    aria-label={`Remove ${l.product.name}`}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
