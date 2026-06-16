import { useState } from "react";

import { Button, Field, Input, Modal, Select } from "./ui";
import { t } from "../lib/i18n";
import { formatMoney, fromMinor, toMinor } from "../lib/format";
import type { Currency, PaymentMethod } from "../lib/types";

interface Props {
  currency: Currency;
  grandTotal: number; // minor units of `currency`
  busy?: boolean;
  onConfirm: (method: PaymentMethod, amountTendered: number) => void;
  onCancel: () => void;
}

export function CheckoutModal({ currency, grandTotal, busy, onConfirm, onCancel }: Props) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState<string>(String(fromMinor(grandTotal, currency)));

  const tenderedMinor = method === "cash" ? toMinor(Number(received) || 0, currency) : grandTotal;
  const change = tenderedMinor - grandTotal;
  const insufficient = method === "cash" && change < 0;

  return (
    <Modal title={t("checkout")} onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-500">{t("total")}</span>
          <span className="text-xl font-semibold tabular-nums">
            {formatMoney(grandTotal, currency)}
          </span>
        </div>

        <Field label={t("payment")}>
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option value="cash">{t("cash")}</option>
            <option value="card">{t("card")}</option>
            <option value="other">{t("other")}</option>
          </Select>
        </Field>

        {method === "cash" ? (
          <>
            <Field label={`${t("amount_tendered")} (${currency})`}>
              <Input
                type="number"
                min={0}
                step={currency === "USD" ? "0.01" : "1"}
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                autoFocus
              />
            </Field>
            <div className="flex items-center justify-between px-1 text-sm">
              <span className="text-slate-500">{t("change_due")}</span>
              <span
                className={`font-medium tabular-nums ${insufficient ? "text-red-600" : "text-slate-800"}`}
              >
                {formatMoney(Math.max(change, 0), currency)}
              </span>
            </div>
          </>
        ) : null}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button
            onClick={() => onConfirm(method, tenderedMinor)}
            disabled={busy || insufficient}
          >
            {t("complete_sale")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
