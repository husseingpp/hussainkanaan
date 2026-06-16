import { Button, Modal } from "./ui";
import { t } from "../lib/i18n";
import { formatMoney } from "../lib/format";
import type { SaleWithItems } from "../lib/types";

interface Props {
  sale: SaleWithItems;
  onClose: () => void;
}

export function Receipt({ sale, onClose }: Props) {
  const c = sale.currency;
  const when = new Date(sale.sold_at);

  return (
    <Modal title={t("receipt")} onClose={onClose}>
      <div className="receipt-print mx-auto max-w-sm text-sm text-slate-800">
        <div className="text-center">
          <div className="text-lg font-bold">{t("app_title")}</div>
          <div className="text-xs text-slate-500">
            {t("sale_no")}
            {sale.sale_no} · {when.toLocaleString()}
          </div>
        </div>

        <hr className="my-3 border-dashed border-slate-300" />

        <table className="w-full">
          <tbody>
            {sale.items.map((it) => (
              <tr key={it.id} className="align-top">
                <td className="py-0.5">
                  {it.product_name}
                  {it.batch_no ? (
                    <span className="text-xs text-slate-400"> · {it.batch_no}</span>
                  ) : null}
                  <div className="text-xs text-slate-400">
                    {it.qty} × {formatMoney(it.unit_price, c)}
                  </div>
                </td>
                <td className="py-0.5 text-right tabular-nums">
                  {formatMoney(it.line_total, c)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <hr className="my-3 border-dashed border-slate-300" />

        <Row label={t("subtotal")} value={formatMoney(sale.subtotal, c)} />
        <Row label={t("vat")} value={formatMoney(sale.vat_total, c)} />
        <Row label={t("total")} value={formatMoney(sale.grand_total, c)} bold />
        <div className="mt-2 text-xs text-slate-500">
          <Row label={t("paid_with")} value={t(sale.payment_method)} small />
          {sale.payment_method === "cash" ? (
            <>
              <Row label={t("amount_tendered")} value={formatMoney(sale.amount_tendered, c)} small />
              <Row label={t("change_due")} value={formatMoney(sale.change_due, c)} small />
            </>
          ) : null}
        </div>

        <div className="mt-4 text-center text-xs text-slate-400">— {t("thank_you")} —</div>
      </div>

      <div className="no-print mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t("new_sale")}
        </Button>
        <Button onClick={() => window.print()}>🖨 {t("print")}</Button>
      </div>
    </Modal>
  );
}

function Row({
  label,
  value,
  bold,
  small,
}: {
  label: string;
  value: string;
  bold?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${bold ? "font-semibold" : ""} ${
        small ? "text-xs" : ""
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
