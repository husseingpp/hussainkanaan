import { useState } from "react";

import { Button, Checkbox, Field, Input, Select } from "./ui";
import { t } from "../lib/i18n";
import type { Product, ProductInput } from "../lib/types";
import { emptyToNull, round } from "../lib/util";

const FORMS = [
  "tablet",
  "capsule",
  "syrup",
  "suspension",
  "cream",
  "ointment",
  "drops",
  "injection",
  "inhaler",
  "other",
];

interface Props {
  /** Existing product when editing; null/undefined when creating. */
  initial?: Product | null;
  /** Barcode to pre-fill (e.g. an unknown scanned code). */
  defaultBarcode?: string;
  /** Default VAT percent from the pharmacy (e.g. 11). */
  defaultVatPercent: number;
  onSubmit: (input: ProductInput) => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}

export function ProductForm({
  initial,
  defaultBarcode,
  defaultVatPercent,
  onSubmit,
  onCancel,
  busy,
}: Props) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    generic_name: initial?.generic_name ?? "",
    barcode: initial?.barcode ?? defaultBarcode ?? "",
    form: initial?.form ?? "",
    strength: initial?.strength ?? "",
    category: initial?.category ?? "",
    manufacturer: initial?.manufacturer ?? "",
    requires_rx: initial?.requires_rx ?? false,
    controlled: initial?.controlled ?? false,
    vatPercent: initial ? round(initial.vat_rate * 100) : defaultVatPercent,
  });

  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }));
  const nameInvalid = f.name.trim().length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInvalid) return;
    const input: ProductInput = {
      name: f.name.trim(),
      generic_name: emptyToNull(f.generic_name),
      barcode: emptyToNull(f.barcode),
      form: emptyToNull(f.form),
      strength: emptyToNull(f.strength),
      category: emptyToNull(f.category),
      manufacturer: emptyToNull(f.manufacturer),
      requires_rx: f.requires_rx,
      controlled: f.controlled,
      vat_rate: (Number(f.vatPercent) || 0) / 100,
    };
    void onSubmit(input);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label={t("name")}>
        <Input
          value={f.name}
          onChange={(e) => set({ name: e.target.value })}
          autoFocus
          required
          placeholder="e.g. Panadol Extra"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("generic_name")}>
          <Input
            value={f.generic_name}
            onChange={(e) => set({ generic_name: e.target.value })}
            placeholder="e.g. Paracetamol"
          />
        </Field>
        <Field label={t("barcode")}>
          <Input
            value={f.barcode}
            onChange={(e) => set({ barcode: e.target.value })}
            placeholder="e.g. 6291041500213"
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label={t("form")}>
          <Select value={f.form} onChange={(e) => set({ form: e.target.value })}>
            <option value="">—</option>
            {FORMS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("strength")}>
          <Input
            value={f.strength}
            onChange={(e) => set({ strength: e.target.value })}
            placeholder="500 mg"
          />
        </Field>
        <Field label={t("vat_rate")}>
          <Input
            type="number"
            min={0}
            step="0.5"
            value={f.vatPercent}
            onChange={(e) => set({ vatPercent: Number(e.target.value) })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("category")}>
          <Input
            value={f.category}
            onChange={(e) => set({ category: e.target.value })}
            placeholder="e.g. Analgesic"
          />
        </Field>
        <Field label={t("manufacturer")}>
          <Input
            value={f.manufacturer}
            onChange={(e) => set({ manufacturer: e.target.value })}
            placeholder="e.g. GSK"
          />
        </Field>
      </div>

      <div className="flex gap-6">
        <Checkbox
          label={t("requires_rx")}
          checked={f.requires_rx}
          onChange={(e) => set({ requires_rx: e.target.checked })}
        />
        <Checkbox
          label={t("controlled")}
          checked={f.controlled}
          onChange={(e) => set({ controlled: e.target.checked })}
        />
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={nameInvalid || busy}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
