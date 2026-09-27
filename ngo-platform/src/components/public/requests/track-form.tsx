"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { track, type TrackResult } from "@/lib/forms/public";
import { formatDate } from "@/lib/format";
import { tr } from "@/lib/i18n/tr";
import { toE164 } from "@/lib/phone";

const input = "w-full rounded-theme border border-foreground/20 bg-white px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/25";

/** Tracking code + phone → status (via the rate-limited check_request_status RPC). */
export function TrackForm({ locale, defaultLocale }: { locale: string; defaultLocale: string }) {
  const t = useTranslations("track");
  const ts = useTranslations("admin.requests.status");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<TrackResult | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const e164 = toE164(phone);
    if (!code.trim() || !e164) return setError(t("err_fields"));
    setBusy(true);
    setError(null);
    const res = await track(code.trim(), e164);
    setBusy(false);
    if (!res.ok) return setError(t(res.error === "rate_limited" ? "err_rate" : "err_unknown"));
    setResult(res.data);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={lookup} className="grid gap-4 rounded-theme border border-foreground/10 bg-white p-6 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <label htmlFor="code" className="block font-medium">{t("code")}</label>
          <input id="code" dir="ltr" placeholder="R-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className={`${input} font-mono`} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="track-phone" className="block font-medium">{t("phone")}</label>
          <input id="track-phone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
        </div>
        <Button type="submit" size="lg" disabled={busy}>{busy ? t("checking") : t("check")}</Button>
      </form>
      {error && <p role="alert" className="rounded-theme bg-red-50 p-3 text-red-800">{error}</p>}
      {result === null && <p role="status" className="rounded-theme border border-dashed border-foreground/20 p-6 text-center">{t("not_found")}</p>}
      {result && (
        <div role="status" className="rounded-theme border border-primary/30 bg-white p-6 shadow-sm">
          <p className="text-sm opacity-70">{tr(result.type_name, locale, defaultLocale)} · <span dir="ltr" className="font-mono">{result.tracking_code}</span></p>
          <p className="mt-2 text-2xl font-bold text-primary">{ts(result.status as "new")}</p>
          {result.public_note && <p className="mt-3 whitespace-pre-wrap">{result.public_note}</p>}
          <p className="mt-3 text-xs opacity-60">{t("updated")} {formatDate(result.updated_at, locale, "medium")}</p>
        </div>
      )}
    </div>
  );
}
