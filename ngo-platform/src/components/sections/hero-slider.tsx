import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getHeroSlides, getSiteSettings } from "@/lib/data/site";
import { tr } from "@/lib/i18n/tr";
import { isExternal, localePath, resolveLink } from "@/lib/routes";
import { HeroCarousel } from "./hero-carousel";
import type { SectionProps } from "./types";

export async function HeroSliderSection({ settings, locale, defaultLocale }: SectionProps<"hero_slider">) {
  const [all, site, t] = await Promise.all([getHeroSlides(), getSiteSettings(), getTranslations()]);
  const picked = settings.slide_ids.length ? all.filter((s) => settings.slide_ids.includes(s.id)) : all;
  const x = (v: unknown) => tr(v, locale, defaultLocale);

  if (!picked.length) {
    // No slides yet: a branded hero built from the organization's name and tagline.
    return (
      <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,var(--color-accent),transparent_55%),radial-gradient(circle_at_85%_85%,var(--color-secondary),transparent_50%)] opacity-70" />
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-36 sm:px-6 sm:pb-32 sm:pt-44">
          <h1 className="max-w-3xl text-balance text-3xl font-bold leading-tight sm:text-5xl">
            {x(site?.org_name) || t("site.name")}
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed opacity-90">
            {x(site?.tagline) || t("site.tagline")}
          </p>
          <Link href={localePath(locale, "/activities")} className="mt-8 inline-flex h-12 items-center rounded-theme bg-secondary px-7 font-medium text-secondary-foreground hover:opacity-90">
            {t("hero.cta")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <HeroCarousel
      autoplay={settings.autoplay}
      interval={settings.interval}
      labels={{ previous: t("slider.previous"), next: t("slider.next"), goTo: t.raw("slider.go_to") as string }}
      slides={picked.map((s) => {
        const label = x(s.cta_label);
        return {
          id: s.id,
          image: s.image_url,
          title: x(s.title),
          subtitle: x(s.subtitle),
          overlay: s.overlay_opacity,
          position: s.text_position as "start" | "center" | "end",
          cta: label && s.cta_link ? { label, href: resolveLink(locale, s.cta_link), external: isExternal(s.cta_link) } : undefined,
        };
      })}
    />
  );
}
