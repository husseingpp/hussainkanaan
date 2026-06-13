import { useCallback, useEffect, useState } from "react";

import { BatchForm } from "../components/BatchForm";
import { ProductForm } from "../components/ProductForm";
import { Badge, Button, ConfirmModal, Modal } from "../components/ui";
import { api } from "../lib/api";
import { t } from "../lib/i18n";
import { convertMinor, daysUntil, formatMoney } from "../lib/format";
import type { Batch, BatchInput, Pharmacy, Product, ProductInput } from "../lib/types";
import { errMessage, round } from "../lib/util";

interface Props {
  productId: string;
  pharmacy: Pharmacy;
  notify: (message: string, kind?: "success" | "error" | "info") => void;
  onBack: () => void;
}

export function ProductDetailPage({ productId, pharmacy, notify, onBack }: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [editProduct, setEditProduct] = useState(false);
  const [batchModal, setBatchModal] = useState<{ open: boolean; initial: Batch | null }>({
    open: false,
    initial: null,
  });
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState(false);
  const [confirmDeleteBatch, setConfirmDeleteBatch] = useState<Batch | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, b] = await Promise.all([
        api.getProduct(productId),
        api.listBatches(productId),
      ]);
      setProduct(p);
      setBatches(b);
    } catch (e) {
      notify(errMessage(e), "error");
    } finally {
      setLoading(false);
    }
  }, [productId, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProduct = async (input: ProductInput) => {
    setBusy(true);
    try {
      await api.updateProduct(productId, input);
      setEditProduct(false);
      notify("Product updated", "success");
      await load();
    } catch (e) {
      notify(errMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const saveBatch = async (input: BatchInput) => {
    setBusy(true);
    try {
      if (batchModal.initial) {
        await api.updateBatch(batchModal.initial.id, input);
        notify("Batch updated", "success");
      } else {
        await api.createBatch(input);
        notify("Batch added", "success");
      }
      setBatchModal({ open: false, initial: null });
      await load();
    } catch (e) {
      notify(errMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteProduct = async () => {
    try {
      await api.deleteProduct(productId);
      notify("Product deleted", "success");
      onBack();
    } catch (e) {
      notify(errMessage(e), "error");
      setConfirmDeleteProduct(false);
    }
  };

  const deleteBatch = async (batch: Batch) => {
    try {
      await api.deleteBatch(batch.id);
      notify("Batch deleted", "success");
      setConfirmDeleteBatch(null);
      await load();
    } catch (e) {
      notify(errMessage(e), "error");
    }
  };

  if (loading || !product) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  const main = pharmacy.main_currency;
  const fx = pharmacy.fx_rate_lbp_per_usd;

  /** Native formatted price plus the converted equivalent in the main currency. */
  const priceCell = (minor: number, currency: Batch["currency"]) => {
    const native = formatMoney(minor, currency);
    if (currency === main) return native;
    const converted = convertMinor(minor, currency, main, fx);
    return (
      <span>
        {native}
        <span className="ml-1 text-xs text-slate-400">
          {converted != null ? `≈ ${formatMoney(converted, main)}` : "(set rate)"}
        </span>
      </span>
    );
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <button onClick={onBack} className="self-start text-sm text-brand hover:underline">
        ← {t("back")}
      </button>

      {/* Product header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-800">{product.name}</h1>
              {product.requires_rx ? <Badge tone="amber">{t("rx")}</Badge> : null}
              {product.controlled ? <Badge tone="red">controlled</Badge> : null}
            </div>
            {product.generic_name ? (
              <p className="text-sm text-slate-500">{product.generic_name}</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditProduct(true)}>
              {t("edit_product")}
            </Button>
            <Button variant="danger" onClick={() => setConfirmDeleteProduct(true)}>
              {t("delete")}
            </Button>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Detail label={t("barcode")} value={product.barcode} mono />
          <Detail label={t("form")} value={product.form} />
          <Detail label={t("strength")} value={product.strength} />
          <Detail label={t("category")} value={product.category} />
          <Detail label={t("manufacturer")} value={product.manufacturer} />
          <Detail label={t("vat_rate")} value={`${round(product.vat_rate * 100)}%`} />
        </dl>
      </div>

      {/* Batches */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-800">
            {t("batches")}{" "}
            <span className="text-sm font-normal text-slate-400">({batches.length})</span>
          </h2>
          <Button onClick={() => setBatchModal({ open: true, initial: null })}>
            + {t("add_batch")}
          </Button>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5 font-medium">{t("batch_no")}</th>
              <th className="px-5 py-2.5 font-medium">{t("expiry_date")}</th>
              <th className="px-5 py-2.5 font-medium">{t("cost_price")}</th>
              <th className="px-5 py-2.5 font-medium">{t("sell_price")}</th>
              <th className="px-5 py-2.5 font-medium">{t("qty_on_hand")}</th>
              <th className="px-5 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => {
              const days = daysUntil(b.expiry_date);
              return (
                <tr key={b.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-2.5 font-mono text-xs text-slate-600">
                    {b.batch_no ?? "—"}
                  </td>
                  <td className="px-5 py-2.5">
                    {b.expiry_date ? (
                      <span className="flex items-center gap-2">
                        {b.expiry_date}
                        {days != null && days < 0 ? (
                          <Badge tone="red">{t("expired")}</Badge>
                        ) : days != null && days <= 90 ? (
                          <Badge tone="amber">{days}d</Badge>
                        ) : null}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-slate-600">
                    {priceCell(b.cost_price, b.currency)}
                  </td>
                  <td className="px-5 py-2.5 font-medium text-slate-800">
                    {priceCell(b.sell_price, b.currency)}
                  </td>
                  <td className="px-5 py-2.5 text-slate-600">{b.qty_on_hand}</td>
                  <td className="px-5 py-2.5 text-right">
                    <div className="flex justify-end gap-3 text-xs">
                      <button
                        className="text-brand hover:underline"
                        onClick={() => setBatchModal({ open: true, initial: b })}
                      >
                        Edit
                      </button>
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => setConfirmDeleteBatch(b)}
                      >
                        {t("delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {batches.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">{t("no_batches")}</div>
        ) : null}
      </div>

      {editProduct ? (
        <Modal title={t("edit_product")} onClose={() => setEditProduct(false)}>
          <ProductForm
            initial={product}
            defaultVatPercent={round(pharmacy.default_vat_rate * 100)}
            onSubmit={saveProduct}
            onCancel={() => setEditProduct(false)}
            busy={busy}
          />
        </Modal>
      ) : null}

      {batchModal.open ? (
        <Modal
          title={batchModal.initial ? t("edit_batch") : t("add_batch")}
          onClose={() => setBatchModal({ open: false, initial: null })}
        >
          <BatchForm
            productId={productId}
            initial={batchModal.initial}
            defaultCurrency={pharmacy.main_currency}
            onSubmit={saveBatch}
            onCancel={() => setBatchModal({ open: false, initial: null })}
            busy={busy}
          />
        </Modal>
      ) : null}

      <ConfirmModal
        open={confirmDeleteProduct}
        title={t("delete")}
        message={`Delete "${product.name}"? This cannot be undone.`}
        confirmLabel={t("delete")}
        onConfirm={() => void deleteProduct()}
        onCancel={() => setConfirmDeleteProduct(false)}
      />
      <ConfirmModal
        open={confirmDeleteBatch !== null}
        title={t("delete")}
        message="Delete this batch? This cannot be undone."
        confirmLabel={t("delete")}
        onConfirm={() => confirmDeleteBatch && void deleteBatch(confirmDeleteBatch)}
        onCancel={() => setConfirmDeleteBatch(null)}
      />
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`text-slate-700 ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</dd>
    </div>
  );
}
