import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/public/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { getModules, getSiteSettings } from "@/lib/data/site";
import { getDefaultLocale } from "@/lib/i18n/locales";
import { tr } from "@/lib/i18n/tr";
import { paragraphs } from "@/lib/format";
import { localePath } from "@/lib/routes";
import { alternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "donate" });
  return { title: t("title"), alternates: await alternates("/donate", locale) };
}

export default async function DonatePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [modules, s, def, t] = await Promise.all([getModules(), getSiteSettings(), getDefaultLocale(), getTranslations()]);
  if (!modules.donate) notFound();
  const info = paragraphs(tr(s?.donate_info, locale, def.code));

  return (
    <>
      <PageHeader title={t("donate.title")} subtitle={t("donate.subtitle")} />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {info.length ? (
          <div className="space-y-4 text-lg leading-relaxed">{info.map((p, i) => <p key={i}>{p}</p>)}</div>
        ) : (
          <p className="text-lg opacity-80">{t("donate.empty")}</p>
        )}
        <Link href={localePath(locale, "/contact")} className={buttonVariants({ className: "mt-8" })}>
          {t("contact.title")}
        </Link>
      </div>
    </>
  );
}
