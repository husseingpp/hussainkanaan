import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Icon } from "@/components/public/icon";
import { PageHeader } from "@/components/public/section-heading";
import { getObjectives, getSectors } from "@/lib/data/content";
import { getDefaultLocale } from "@/lib/i18n/locales";
import { tr } from "@/lib/i18n/tr";
import { localePath } from "@/lib/routes";
import { alternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "objectives" });
  return { title: t("title"), description: t("subtitle"), alternates: await alternates("/objectives", locale) };
}

export default async function ObjectivesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, objectives, sectors, def] = await Promise.all([getTranslations("objectives"), getObjectives(), getSectors(), getDefaultLocale()]);
  const x = (v: unknown) => tr(v, locale, def.code);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ol className="mx-auto grid max-w-4xl gap-4 px-4 py-12 sm:px-6">
        {objectives.map((o, i) => {
          const sector = sectors.find((s) => s.id === o.sector_id);
          return (
            <li key={o.id} className="flex gap-4 rounded-theme border border-foreground/10 bg-white p-5 shadow-sm">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
              <div>
                <p className="text-lg leading-relaxed">{x(o.text)}</p>
                {sector && (
                  <Link href={localePath(locale, `/sectors/${sector.slug}`)} className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <Icon icon={sector.icon} className="size-4" />
                    {x(sector.name)}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
