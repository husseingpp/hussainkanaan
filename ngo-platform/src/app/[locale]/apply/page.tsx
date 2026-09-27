import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/public/section-heading";
import { FormList } from "@/components/public/requests/form-list";
import { getModules } from "@/lib/data/site";
import { getDefaultLocale } from "@/lib/i18n/locales";
import { localePath } from "@/lib/routes";
import { alternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "apply" });
  return { title: t("title"), alternates: await alternates("/apply", locale) };
}

// 404 while the requests module is off (CLAUDE.md rule 9).
export default async function ApplyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getModules()).requests) notFound();
  const [t, def] = await Promise.all([getTranslations("apply"), getDefaultLocale()]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        <Link href={localePath(locale, "/track")} className="mt-4 inline-block text-primary underline">{t("track_link")}</Link>
      </PageHeader>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <FormList locale={locale} defaultLocale={def.code} />
      </div>
    </>
  );
}
