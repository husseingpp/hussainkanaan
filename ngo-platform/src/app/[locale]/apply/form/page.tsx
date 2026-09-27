import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApplyForm } from "@/components/public/requests/apply-form";
import { getModules } from "@/lib/data/site";
import { getDefaultLocale } from "@/lib/i18n/locales";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "apply" });
  return { title: t("title"), robots: { index: false } };
}

// ?type=<form slug>; the form is loaded in the browser, so new forms work without a rebuild.
export default async function ApplyFormPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getModules()).requests) notFound();
  const def = await getDefaultLocale();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <ApplyForm locale={locale} defaultLocale={def.code} />
    </div>
  );
}
