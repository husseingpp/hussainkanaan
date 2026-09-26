import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Icon } from "@/components/public/icon";
import { PostCard, PostGrid } from "@/components/public/post-card";
import { getObjectives, getPostCards, getSector, getSectors } from "@/lib/data/content";
import { getDefaultLocale } from "@/lib/i18n/locales";
import { tr } from "@/lib/i18n/tr";
import { alternates } from "@/lib/seo";
import { slugParams } from "@/lib/static-params";

type Props = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  return slugParams((await getSectors()).map((s) => s.slug));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const [sector, def] = await Promise.all([getSector(slug), getDefaultLocale()]);
  if (!sector) return {};
  return {
    title: tr(sector.name, locale, def.code),
    ...(tr(sector.description, locale, def.code) && { description: tr(sector.description, locale, def.code) }),
    alternates: await alternates(`/sectors/${slug}`, locale),
  };
}

export default async function SectorPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [sector, def, t] = await Promise.all([getSector(slug), getDefaultLocale(), getTranslations("sectors")]);
  if (!sector) notFound();
  const x = (v: unknown) => tr(v, locale, def.code);
  const [objectives, posts] = await Promise.all([getObjectives(), getPostCards("activity")]);
  const mine = objectives.filter((o) => o.sector_id === sector.id);
  const activities = posts.filter((p) => p.sector_ids.includes(sector.id));

  return (
    <>
      <header className="relative isolate overflow-hidden bg-primary text-primary-foreground">
        {sector.cover_image && (
          <>
            <Image src={sector.cover_image} alt="" fill priority sizes="100vw" className="-z-10 object-cover" />
            <div className="absolute inset-0 -z-10 bg-black/50" />
          </>
        )}
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <span className="grid size-14 place-items-center rounded-theme bg-white/15">
            <Icon icon={sector.icon} fallback="layout-grid" className="size-7" />
          </span>
          <h1 className="mt-5 text-3xl font-bold sm:text-4xl">{x(sector.name)}</h1>
          {x(sector.description) && <p className="mt-3 max-w-2xl text-lg opacity-90">{x(sector.description)}</p>}
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12 sm:px-6">
        {mine.length > 0 && (
          <section aria-labelledby="objectives">
            <h2 id="objectives" className="mb-5 text-2xl font-bold">{t("objectives")}</h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {mine.map((o) => (
                <li key={o.id} className="flex gap-3 rounded-theme bg-primary/5 p-4">
                  <Icon icon={o.icon ?? sector.icon} fallback="target" className="mt-0.5 size-5 shrink-0 text-primary" />
                  <span className="leading-relaxed">{x(o.text)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section aria-labelledby="activities">
          <h2 id="activities" className="mb-5 text-2xl font-bold">{t("activities")}</h2>
          {activities.length ? (
            <PostGrid>
              {activities.map((p, i) => (
                <PostCard key={p.id} post={p} locale={locale} defaultLocale={def.code} priority={i === 0} />
              ))}
            </PostGrid>
          ) : (
            <p className="rounded-theme border border-dashed border-foreground/20 p-8 text-center opacity-75">{t("empty")}</p>
          )}
        </section>
      </div>
    </>
  );
}
