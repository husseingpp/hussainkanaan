import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/public/section-heading";
import { TrackForm } from "@/components/public/requests/track-form";
import { getModules } from "@/lib/data/site";
import { getDefaultLocale } from "@/lib/i18n/locales";
import { alternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "track" });
  return { title: t("title"), alternates: await alternates("/track", locale), robots: { index: false } };
}

export default async function TrackPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getModules()).requests) notFound();
  const [t, def] = await Promise.all([getTranslations("track"), getDefaultLocale()]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <TrackForm locale={locale} defaultLocale={def.code} />
      </div>
    </>
  );
}
