import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/public/section-heading";
import { SectorCards } from "@/components/sections/sectors-grid";
import { getSectors } from "@/lib/data/content";
import { getDefaultLocale } from "@/lib/i18n/locales";
import { alternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sectors" });
  return { title: t("title"), description: t("subtitle"), alternates: await alternates("/sectors", locale) };
}

export default async function SectorsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, sectors, def] = await Promise.all([getTranslations("sectors"), getSectors(), getDefaultLocale()]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <SectorCards sectors={sectors} locale={locale} defaultLocale={def.code} className="grid-cols-2 lg:grid-cols-4" />
      </div>
    </>
  );
}
