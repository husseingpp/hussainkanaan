import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { getSections } from "@/lib/data/site";
import { getDefaultLocale } from "@/lib/i18n/locales";
import { alternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: await alternates("/", locale) };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [sections, def] = await Promise.all([getSections("home"), getDefaultLocale()]);
  return <SectionRenderer sections={sections} locale={locale} defaultLocale={def.code} />;
}
