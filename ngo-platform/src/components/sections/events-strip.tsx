import Link from "next/link";
import { MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getPostCards } from "@/lib/data/content";
import { tr } from "@/lib/i18n/tr";
import { dateParts } from "@/lib/format";
import { localePath, postPath } from "@/lib/routes";
import { SectionHeading } from "@/components/public/section-heading";
import { SectionShell } from "./section-shell";
import type { SectionProps } from "./types";

export async function EventsStripSection({ section, settings, locale, defaultLocale }: SectionProps<"events_strip">) {
  const [all, t] = await Promise.all([getPostCards("event"), getTranslations()]);
  const events = all.slice(0, settings.count);
  if (!events.length) return null;
  const x = (v: unknown) => tr(v, locale, defaultLocale);
  const id = `s-${section.id}`;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <SectionShell tone="tinted" labelledBy={id}>
      <SectionHeading
        id={id}
        title={x(section.title) || t("events.title")}
        subtitle={x(section.subtitle)}
        action={{ href: localePath(locale, "/events"), label: t("common.view_all") }}
      />
      <ul className="grid gap-4 md:grid-cols-2">
        {events.map((e) => {
          const d = e.event_date ? dateParts(e.event_date, locale) : null;
          return (
            <li key={e.id} className="relative flex gap-4 rounded-theme bg-white p-4 shadow-sm transition hover:shadow-md">
              {d && (
                <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-theme bg-primary py-2 text-primary-foreground">
                  <span className="text-2xl font-bold leading-none">{d.day}</span>
                  <span className="mt-1 text-xs">{d.month}</span>
                  <span className="text-xs opacity-80">{d.year}</span>
                </div>
              )}
              <div className="min-w-0 py-1">
                {e.event_date && e.event_date >= today && (
                  <span className="mb-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">{t("events.upcoming")}</span>
                )}
                <h3 className="font-semibold leading-snug">
                  <Link href={postPath(locale, "event", e.slug)} className="after:absolute after:inset-0">{x(e.title)}</Link>
                </h3>
                {x(e.location) && (
                  <p className="mt-1 inline-flex items-center gap-1 text-sm opacity-70">
                    <MapPin aria-hidden className="size-4" /> {x(e.location)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}
