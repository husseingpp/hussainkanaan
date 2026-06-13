import { useCallback, useEffect, useState } from "react";

import { ScannerInput } from "../components/ScannerInput";
import { ProductForm } from "../components/ProductForm";
import { Badge, Button, Input, Modal } from "../components/ui";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { api } from "../lib/api";
import { t } from "../lib/i18n";
import type { Pharmacy, Product, ProductInput } from "../lib/types";
import { errMessage, round } from "../lib/util";

interface Props {
  pharmacy: Pharmacy;
  notify: (message: string, kind?: "success" | "error" | "info") => void;
  onOpenProduct: (id: string) => void;
}

export function ProductsPage({ pharmacy, notify, onOpenProduct }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [addBarcode, setAddBarcode] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (term: string) => {
      setLoading(true);
      try {
        const rows = term.trim()
          ? await api.searchProducts(term)
          : await api.listProducts();
        setProducts(rows);
      } catch (e) {
        notify(errMessage(e), "error");
      } finally {
        setLoading(false);
      }
    },
    [notify],
  );

  // Debounced search as the query changes.
  useEffect(() => {
    const id = window.setTimeout(() => void load(query), 150);
    return () => window.clearTimeout(id);
  }, [query, load]);

  // Resolve a scanned/typed barcode to a product, or offer to create one.
  const resolveScan = useCallback(
    async (code: string) => {
      try {
        const found = await api.findProductByBarcode(code);
        if (found) {
          onOpenProduct(found.id);
        } else {
          notify(`No product for barcode ${code} — add it?`, "info");
          setAddBarcode(code);
          setShowForm(true);
        }
      } catch (e) {
        notify(errMessage(e), "error");
      }
    },
    [notify, onOpenProduct],
  );

  // Global safety-net capture for scans when focus is outside the scanner field.
  useBarcodeScanner(resolveScan, { enabled: !showForm });

  const createProduct = async (input: ProductInput) => {
    setBusy(true);
    try {
      const created = await api.createProduct(input);
      setShowForm(false);
      setAddBarcode(undefined);
      notify(`Added "${created.name}"`, "success");
      await load(query);
    } catch (e) {
      notify(errMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800">
          {t("products")}{" "}
          <span className="text-sm font-normal text-slate-400">({products.length})</span>
        </h1>
        <Button
          onClick={() => {
            setAddBarcode(undefined);
            setShowForm(true);
          }}
        >
          + {t("add_product")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ScannerInput onScan={resolveScan} />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search_placeholder")}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t("name")}</th>
              <th className="px-4 py-2.5 font-medium">{t("barcode")}</th>
              <th className="px-4 py-2.5 font-medium">{t("form")}</th>
              <th className="px-4 py-2.5 font-medium">Flags</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr
                key={p.id}
                onClick={() => onOpenProduct(p.id)}
                className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-2.5">
                  <div className="font-medium text-slate-800">{p.name}</div>
                  {p.generic_name ? (
                    <div className="text-xs text-slate-400">{p.generic_name}</div>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                  {p.barcode ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {[p.form, p.strength].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {p.requires_rx ? <Badge tone="amber">{t("rx")}</Badge> : null}
                    {p.controlled ? <Badge tone="red">controlled</Badge> : null}
                    {round(p.vat_rate * 100) > 0 ? (
                      <Badge tone="slate">VAT {round(p.vat_rate * 100)}%</Badge>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="text-xs text-brand">Open →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && products.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">
            {query.trim() ? t("no_results") : t("no_products")}
          </div>
        ) : null}
        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">Loading…</div>
        ) : null}
      </div>

      {showForm ? (
        <Modal
          title={t("add_product")}
          onClose={() => {
            setShowForm(false);
            setAddBarcode(undefined);
          }}
        >
          <ProductForm
            defaultBarcode={addBarcode}
            defaultVatPercent={round(pharmacy.default_vat_rate * 100)}
            onSubmit={createProduct}
            onCancel={() => {
              setShowForm(false);
              setAddBarcode(undefined);
            }}
            busy={busy}
          />
        </Modal>
      ) : null}
    </div>
  );
}
