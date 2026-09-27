"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormFields, type Answers } from "@/components/forms/form-fields";
import { openForm, submit, type PublicForm } from "@/lib/forms/public";
import { tr } from "@/lib/i18n/tr";
import { toE164 } from "@/lib/phone";

const input = "w-full rounded-theme border border-foreground/20 bg-white px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 aria-[invalid=true]:border-red-600";

function ApplyFormInner({ locale, defaultLocale }: { locale: string; defaultLocale: string }) {
  const t = useTranslations("apply");
  const slug = useSearchParams().get("type") ?? "";
  const [form, setForm] = useState<PublicForm | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => void openForm(slug).then(setForm), [slug]);
  const x = (v: unknown) => tr(v, locale, defaultLocale);

  if (form === undefined) return <p className="py-10 text-center opacity-70">{t("loading")}</p>;
  if (form === null) return <p className="rounded-theme border border-dashed border-foreground/20 p-10 text-center">{t("not_found")} <Link href={`/${locale}/apply`} className="text-primary underline">{t("all_forms")}</Link></p>;

  if (code) {
    return (
      <div className="rounded-theme border border-primary/30 bg-white p-8 text-center shadow-sm" role="status">
        <CheckCircle2 aria-hidden className="mx-auto size-12 text-primary" />
        <h2 className="mt-4 text-2xl font-bold">{t("sent_title")}</h2>
        <p className="mt-2 opacity-80">{t("sent_body")}</p>
        <p className="mt-6 text-sm opacity-70">{t("your_code")}</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-wider" dir="ltr">{code}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigator.clipboard?.writeText(code)}><Copy aria-hidden /> {t("copy_code")}</Button>
        <p className="mt-6"><Link href={`/${locale}/track`} className="text-primary underline">{t("track_link")}</Link></p>
      </div>
    );
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const e164 = toE164(phone);
    if (name.trim().length < 2) errs.full_name = t("err_required");
    if (!e164) errs.phone = t("err_phone");
    for (const f of form.fields) {
      const v = answers[f.key];
      if (f.required && (!v || (Array.isArray(v) ? !v.length : !v.trim()))) errs[f.key] = t("err_required");
    }
    if (!consent) errs.consent = t("err_consent");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const res = await submit(form.slug, { fullName: name, phone: e164!, answers, consent, locale });
    setBusy(false);
    if (res.ok) return setCode(res.code);
    const [kind, key] = res.error.split(":");
    if ((kind === "missing" || kind === "invalid") && key) setErrors({ [key]: kind === "missing" ? t("err_required") : t("err_invalid") });
    else setErrors({ form: t(res.error === "rate_limited" ? "err_rate" : res.error === "form_closed" || res.error === "requests_closed" ? "err_closed" : "err_unknown") });
  };

  return (
    <form onSubmit={send} noValidate className="space-y-6 rounded-theme border border-foreground/10 bg-white p-6 shadow-sm sm:p-8">
      <div>
        <h2 className="text-2xl font-bold">{x(form.name)}</h2>
        {x(form.description) && <p className="mt-2 opacity-80">{x(form.description)}</p>}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="full_name" className="block font-medium">{t("full_name")} <span className="text-red-700" aria-hidden>*</span></label>
        <input id="full_name" autoComplete="name" required aria-invalid={Boolean(errors.full_name)} value={name} onChange={(e) => setName(e.target.value)} className={input} />
        {errors.full_name && <p role="alert" className="text-sm text-red-700">{errors.full_name}</p>}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="phone" className="block font-medium">{t("phone")} <span className="text-red-700" aria-hidden>*</span></label>
        <input id="phone" type="tel" dir="ltr" autoComplete="tel" required aria-invalid={Boolean(errors.phone)} placeholder="71 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
        {errors.phone && <p role="alert" className="text-sm text-red-700">{errors.phone}</p>}
      </div>
      <FormFields fields={form.fields} values={answers} onChange={(k, v) => setAnswers((a) => ({ ...a, [k]: v }))} locale={locale} defaultLocale={defaultLocale} errors={errors} requiredLabel={t("required")} />
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={Boolean(errors.consent)} className="mt-1 size-4 accent-[var(--color-primary)]" />
        <span className="text-sm">
          {t("consent")} <Link href={`/${locale}/privacy`} className="text-primary underline" target="_blank">{t("privacy")}</Link>
        </span>
      </label>
      {errors.consent && <p role="alert" className="text-sm text-red-700">{errors.consent}</p>}
      {errors.form && <p role="alert" className="rounded-theme bg-red-50 p-3 text-sm text-red-800">{errors.form}</p>}
      <Button type="submit" size="lg" disabled={busy} className="w-full sm:w-auto">{busy ? t("sending") : t("send")}</Button>
    </form>
  );
}

export function ApplyForm(props: { locale: string; defaultLocale: string }) {
  return <Suspense fallback={null}><ApplyFormInner {...props} /></Suspense>;
}
