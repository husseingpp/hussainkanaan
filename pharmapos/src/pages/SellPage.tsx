import { useCallback, useEffect, useState } from "react";

import { CheckoutModal } from "../components/CheckoutModal";
import { Receipt } from "../components/Receipt";
import { ScannerInput } from "../components/ScannerInput";
import { Button, Input, Select } from "../components/ui";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { api } from "../lib/api";
import { cartTotals, lineUnitPrice, type CartLine } from "../lib/cart";
import { formatMoney } from "../lib/format";
import { t } from "../lib/i18n";
import type { Currency, PaymentMethod, Pharmacy, Product, SaleWithItems } from "../lib/types";
import { errMessage } from "../lib/util";

interface Props {
  pharmacy: Pharmacy;
  notify: (message: string, kind?: "success" | "error" | "info") => void;
}

export function SellPage({ pharmacy, notify }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [settlement, setSettlement] = useState<Currency>(pharmacy.main_currency);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receipt, setReceipt] = useState<SaleWithItems | null>(null);
  const [busy, setBusy] = useState(false);

  const fx = pharmacy.fx_rate_lbp_per_usd;
  const totals = cartTotals(cart, settlement, fx);

  // Debounced product search for the manual add path.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const id = window.setTimeout(async () => {
      try {
        setResults(await api.searchProducts(query));
      } catch (e) {
        notify(errMessage(e), "error");
      }
    }, 150);
    return () => window.clearTimeout(id);
  }, [query, notify]);

  const addByProductId = useCallback(
    async (productId: string) => {
      try {
        const info = await api.getSellInfo(productId);
        if (info.total_qty <= 0 || info.best_sell_price === null || info.best_currency === null) {
          notify(`${info.name}: ${t("out_of_stock")}`, "info");
          return;
        }
        setCart((prev) => {
          const existing = prev.find((l) => l.product_id === productId);
          if (existing) {
            if (existing.qty >= existing.available) {
              notify(`Only ${existing.available} ${t("in_stock")}`, "info");
              return prev;
            }
            return prev.map((l) =>
              l.product_id === productId ? { ...l, qty: l.qty + 1 } : l,
            );
          }
          const line: CartLine = {
            product_id: info.product_id,
            name: info.name,
            vat_rate: info.vat_rate,
            batch_currency: info.best_currency as Currency,
            batch_unit_price: info.best_sell_price as number,
            available: info.total_qty,
            qty: 1,
          };
          return [...prev, line];
        });
      } catch (e) {
        notify(errMessage(e), "error");
      }
    },
    [notify],
  );

  const resolveScan = useCallback(
    async (code: string) => {
      try {
        const found = await api.findProductByBarcode(code);
        if (found) {
          await addByProductId(found.id);
        } else {
          notify(`No product for barcode ${code}`, "info");
        }
      } catch (e) {
        notify(errMessage(e), "error");
      }
    },
    [addByProductId, notify],
  );

  useBarcodeScanner(resolveScan, { enabled: !checkoutOpen && receipt === null });

  const setQty = (productId: string, qty: number) =>
    setCart((prev) =>
      prev
        .map((l) =>
          l.product_id === productId
            ? { ...l, qty: Math.max(0, Math.min(qty, l.available)) }
            : l,
        )
        .filter((l) => l.qty > 0),
    );

  const doCheckout = async (method: PaymentMethod, amountTendered: number) => {
    setBusy(true);
    try {
      const sale = await api.createSale({
        currency: settlement,
        payment_method: method,
        amount_tendered: amountTendered,
        note: null,
        lines: cart.map((l) => ({ product_id: l.product_id, qty: l.qty })),
      });
      setCheckoutOpen(false);
      setCart([]);
      setReceipt(sale);
      notify(`Sale #${sale.sale_no} completed`, "success");
    } catch (e) {
      notify(errMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-4 py-6 lg:grid-cols-[1fr_360px]">
      {/* Left: find products */}
      <div className="flex flex-col gap-3">
        <ScannerInput onScan={resolveScan} />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search_placeholder")}
        />
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">
              {query.trim() ? t("no_results") : "Scan or search, then tap a product to add it."}
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => void addByProductId(p.id)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                  >
                    <span>
                      <span className="font-medium text-slate-800">{p.name}</span>
                      {p.generic_name ? (
                        <span className="text-xs text-slate-400"> · {p.generic_name}</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-brand">+ {t("cart")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right: cart */}
      <div className="flex h-fit flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">
            {t("cart")}{" "}
            <span className="text-sm font-normal text-slate-400">({cart.length})</span>
          </h2>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            {t("settlement_currency")}
            <Select
              value={settlement}
              onChange={(e) => setSettlement(e.target.value as Currency)}
              className="py-1"
            >
              <option value="USD">USD ($)</option>
              <option value="LBP">LBP (L£)</option>
            </Select>
          </label>
        </div>

        {cart.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">{t("cart_empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-50">
            {cart.map((l) => {
              const unit = lineUnitPrice(l, settlement, fx);
              return (
                <li key={l.product_id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">{l.name}</div>
                    <div className="text-xs text-slate-400">
                      {unit !== null ? formatMoney(unit, settlement) : t("set_fx_first")}
                      {l.batch_currency !== settlement ? (
                        <span className="ml-1">({l.batch_currency})</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setQty(l.product_id, l.qty - 1)}
                      className="h-6 w-6 rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums">{l.qty}</span>
                    <button
                      onClick={() => setQty(l.product_id, l.qty + 1)}
                      disabled={l.qty >= l.available}
                      className="h-6 w-6 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <div className="w-20 text-right text-sm tabular-nums text-slate-700">
                    {unit !== null ? formatMoney(unit * l.qty, settlement) : "—"}
                  </div>
                  <button
                    onClick={() => setQty(l.product_id, 0)}
                    aria-label={t("remove")}
                    className="text-slate-300 hover:text-red-500"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-1 flex flex-col gap-1 border-t border-slate-100 pt-3 text-sm">
          <Row label={t("subtotal")} value={formatMoney(totals.subtotal, settlement)} />
          <Row label={t("vat")} value={formatMoney(totals.vat, settlement)} />
          <Row label={t("total")} value={formatMoney(totals.grand, settlement)} bold />
        </div>

        {!totals.convertible ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {t("set_fx_first")}
          </p>
        ) : null}

        <Button
          className="mt-1"
          disabled={cart.length === 0 || !totals.convertible}
          onClick={() => setCheckoutOpen(true)}
        >
          {t("checkout")} · {formatMoney(totals.grand, settlement)}
        </Button>
      </div>

      {checkoutOpen ? (
        <CheckoutModal
          currency={settlement}
          grandTotal={totals.grand}
          busy={busy}
          onConfirm={(method, tendered) => void doCheckout(method, tendered)}
          onCancel={() => setCheckoutOpen(false)}
        />
      ) : null}

      {receipt ? <Receipt sale={receipt} onClose={() => setReceipt(null)} /> : null}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-semibold text-slate-900" : "text-slate-500"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
