import type { NewPaymentInput } from '../../data/repository';
import type { Sale } from '../../data/types';
import { formatLBP, formatUSD, usdCentsToLbp, type ChangeResult } from '../../lib/money';

export interface ReceiptLine {
  name: string;
  qty: number;
  unitPriceUsdCents: number;
  lineTotalUsdCents: number;
}

export interface ReceiptModel {
  storeName: string;
  sale: Sale;
  lines: ReceiptLine[];
  payments: NewPaymentInput[];
  change: ChangeResult;
  rate: number;
}

function Dual({ usd, rate }: { usd: number; rate: number }) {
  return (
    <span className="tabular-nums">
      {formatUSD(usd)} <span className="text-slate-400">/</span> {formatLBP(usdCentsToLbp(usd, rate))}
    </span>
  );
}

export function ReceiptPreview({ receipt, onClose }: { receipt: ReceiptModel; onClose: () => void }) {
  const { sale, rate } = receipt;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm">
        <div
          id="receipt"
          className="mx-auto max-w-[320px] rounded-lg bg-white p-5 font-mono text-xs leading-relaxed text-slate-800 shadow-xl"
        >
          <div className="text-center">
            <div className="text-sm font-bold">{receipt.storeName}</div>
            <div className="text-[10px] text-slate-400">Prices VAT-inclusive (11%)</div>
            <div className="text-[10px] text-slate-400">
              {new Date(sale.created_at).toLocaleString()}
            </div>
          </div>

          <div className="my-2 border-t border-dashed border-slate-300" />

          <table className="w-full">
            <tbody>
              {receipt.lines.map((l, i) => (
                <tr key={i} className="align-top">
                  <td className="py-0.5 pr-2">
                    {l.name}
                    <div className="text-[10px] text-slate-400">
                      {l.qty} × {formatUSD(l.unitPriceUsdCents)}
                    </div>
                  </td>
                  <td className="py-0.5 text-right">
                    <Dual usd={l.lineTotalUsdCents} rate={rate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="my-2 border-t border-dashed border-slate-300" />

          <Line label="Subtotal" usd={sale.subtotal_usd_cents} rate={rate} />
          {sale.discount_usd_cents > 0 && (
            <Line label="Discount" usd={-sale.discount_usd_cents} rate={rate} />
          )}
          <Line label="of which VAT" usd={sale.vat_usd_cents} rate={rate} muted />
          <div className="mt-1 flex justify-between border-t border-slate-300 pt-1 font-bold">
            <span>TOTAL</span>
            <Dual usd={sale.total_usd_cents} rate={rate} />
          </div>

          <div className="mt-1 text-[10px] text-slate-400">
            Exchange rate: 1 USD = {sale.exchange_rate.toLocaleString()} L.L.
          </div>

          <div className="my-2 border-t border-dashed border-slate-300" />

          <div className="space-y-0.5">
            {receipt.payments.map((p, i) => (
              <div key={i} className="flex justify-between">
                <span className="capitalize text-slate-500">{p.method}</span>
                <span className="tabular-nums">
                  {p.currency === 'USD' ? formatUSD(p.amount_minor) : formatLBP(p.amount_minor)}
                </span>
              </div>
            ))}
            <div className="flex justify-between font-semibold">
              <span>Change</span>
              <span className="tabular-nums">{formatLBP(receipt.change.roundedChangeLbp)}</span>
            </div>
            {receipt.change.roundingLbp !== 0 && (
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Rounding</span>
                <span className="tabular-nums">
                  {receipt.change.roundingLbp > 0 ? '+' : ''}
                  {formatLBP(receipt.change.roundingLbp)}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 text-center text-[10px] text-slate-400">Thank you · شكراً</div>
        </div>

        <div className="mt-4 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            Print
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            New sale
          </button>
        </div>
      </div>
    </div>
  );
}

function Line({
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
    <div className={`flex justify-between ${muted ? 'text-[10px] text-slate-400' : ''}`}>
      <span>{label}</span>
      <Dual usd={usd} rate={rate} />
    </div>
  );
}
