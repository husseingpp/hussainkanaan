import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/public/section-heading";
import { alternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return { title: t("title"), alternates: await alternates("/privacy", locale) };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");
  return (
    <>
      <PageHeader title={t("title")} />
      <div className="prose-ngo mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {(["p1", "p2", "p3", "p4"] as const).map((k) => <p key={k}>{t(k)}</p>)}
      </div>
    </>
  );
}
