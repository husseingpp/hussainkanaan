import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PostListing } from "@/components/public/post-listing";
import { alternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "news" });
  return { title: t("title"), description: t("subtitle"), alternates: await alternates("/news", locale) };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PostListing kind="news" locale={locale} />;
}
