import { useState } from "react";

import { Button, Field, Input, Modal, Select } from "./ui";
import { t } from "../lib/i18n";
import { api } from "../lib/api";
import type { Currency, Pharmacy } from "../lib/types";
import { errMessage, round } from "../lib/util";

interface Props {
  pharmacy: Pharmacy;
  onSaved: (updated: Pharmacy) => void;
  onClose: () => void;
  notify: (message: string, kind?: "success" | "error" | "info") => void;
}

export function CurrencySettings({ pharmacy, onSaved, onClose, notify }: Props) {
  const [mainCurrency, setMainCurrency] = useState<Currency>(pharmacy.main_currency);
  const [fx, setFx] = useState(
    pharmacy.fx_rate_lbp_per_usd != null ? String(pharmacy.fx_rate_lbp_per_usd) : "",
  );
  const [vatPercent, setVatPercent] = useState(round(pharmacy.default_vat_rate * 100));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const fxValue = fx.trim() === "" ? null : Number(fx);
      const updated = await api.updateCurrencySettings(
        mainCurrency,
        fxValue,
        (Number(vatPercent) || 0) / 100,
      );
      onSaved(updated);
      notify("Settings saved", "success");
      onClose();
    } catch (e) {
      notify(errMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("currency_settings")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label={t("main_currency")} hint="Switch the primary display currency anytime.">
          <Select
            value={mainCurrency}
            onChange={(e) => setMainCurrency(e.target.value as Currency)}
          >
            <option value="USD">USD ($)</option>
            <option value="LBP">LBP (L£)</option>
          </Select>
        </Field>

        <Field label={t("fx_rate")} hint="Used to show the converted equivalent of a price.">
          <Input
            type="number"
            min={0}
            step="1"
            value={fx}
            onChange={(e) => setFx(e.target.value)}
            placeholder="e.g. 89000"
          />
        </Field>

        <Field label={t("default_vat")}>
          <Input
            type="number"
            min={0}
            step="0.5"
            value={vatPercent}
            onChange={(e) => setVatPercent(Number(e.target.value))}
          />
        </Field>

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {t("save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
