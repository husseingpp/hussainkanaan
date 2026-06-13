import { useState } from "react";

import { Button, Field, Input, Select } from "./ui";
import { t } from "../lib/i18n";
import { fromMinor, toMinor } from "../lib/format";
import type { Batch, BatchInput, Currency } from "../lib/types";
import { emptyToNull } from "../lib/util";

interface Props {
  productId: string;
  initial?: Batch | null;
  /** Default currency from the pharmacy's main currency. */
  defaultCurrency: Currency;
  onSubmit: (input: BatchInput) => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}

export function BatchForm({
  productId,
  initial,
  defaultCurrency,
  onSubmit,
  onCancel,
  busy,
}: Props) {
  const [f, setF] = useState({
    batch_no: initial?.batch_no ?? "",
    expiry_date: initial?.expiry_date ?? "",
    currency: (initial?.currency ?? defaultCurrency) as Currency,
    cost: initial ? String(fromMinor(initial.cost_price, initial.currency)) : "",
    sell: initial ? String(fromMinor(initial.sell_price, initial.currency)) : "",
    qty: initial ? String(initial.qty_on_hand) : "0",
    supplier_id: initial?.supplier_id ?? "",
  });

  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: BatchInput = {
      product_id: productId,
      batch_no: emptyToNull(f.batch_no),
      expiry_date: emptyToNull(f.expiry_date),
      currency: f.currency,
      cost_price: toMinor(Number(f.cost) || 0, f.currency),
      sell_price: toMinor(Number(f.sell) || 0, f.currency),
      qty_on_hand: Math.trunc(Number(f.qty) || 0),
      supplier_id: emptyToNull(f.supplier_id),
    };
    void onSubmit(input);
  };

  const step = f.currency === "USD" ? "0.01" : "1";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("batch_no")}>
          <Input
            value={f.batch_no}
            onChange={(e) => set({ batch_no: e.target.value })}
            placeholder="e.g. LOT-2291"
            autoFocus
          />
        </Field>
        <Field label={t("expiry_date")}>
          <Input
            type="date"
            value={f.expiry_date}
            onChange={(e) => set({ expiry_date: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label={t("currency")}>
          <Select
            value={f.currency}
            onChange={(e) => set({ currency: e.target.value as Currency })}
          >
            <option value="USD">USD ($)</option>
            <option value="LBP">LBP (L£)</option>
          </Select>
        </Field>
        <Field label={t("cost_price")}>
          <Input
            type="number"
            min={0}
            step={step}
            value={f.cost}
            onChange={(e) => set({ cost: e.target.value })}
          />
        </Field>
        <Field label={t("sell_price")}>
          <Input
            type="number"
            min={0}
            step={step}
            value={f.sell}
            onChange={(e) => set({ sell: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("qty_on_hand")}>
          <Input
            type="number"
            min={0}
            step="1"
            value={f.qty}
            onChange={(e) => set({ qty: e.target.value })}
          />
        </Field>
        <Field label={t("supplier_id")} hint="Free text for now; suppliers arrive later.">
          <Input
            value={f.supplier_id}
            onChange={(e) => set({ supplier_id: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={busy}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
