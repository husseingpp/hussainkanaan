"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";
import { openForms, type PublicForm } from "@/lib/forms/public";
import { tr } from "@/lib/i18n/tr";

/** Live list of open forms (fetched in the browser, so new forms appear without a rebuild). */
export function FormList({ locale, defaultLocale }: { locale: string; defaultLocale: string }) {
  const t = useTranslations("apply");
  const [forms, setForms] = useState<PublicForm[] | null>(null);
  useEffect(() => void openForms().then((f) => setForms(f ?? [])), []);

  if (!forms) return <p className="py-10 text-center opacity-70">{t("loading")}</p>;
  if (!forms.length) return <p className="rounded-theme border border-dashed border-foreground/20 p-10 text-center opacity-75">{t("none")}</p>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {forms.map((f) => (
        <li key={f.id}>
          <Link href={`/${locale}/apply/form?type=${f.slug}`} className="flex h-full gap-4 rounded-theme border border-foreground/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="grid size-11 shrink-0 place-items-center rounded-theme bg-primary/10 text-primary"><ClipboardList aria-hidden className="size-5" /></span>
            <span>
              <span className="block text-lg font-semibold">{tr(f.name, locale, defaultLocale)}</span>
              {tr(f.description, locale, defaultLocale) && <span className="mt-1 block opacity-75">{tr(f.description, locale, defaultLocale)}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
