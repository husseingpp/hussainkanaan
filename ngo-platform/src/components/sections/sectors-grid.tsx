import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSectors } from "@/lib/data/content";
import { tr } from "@/lib/i18n/tr";
import { localePath } from "@/lib/routes";
import { Icon } from "@/components/public/icon";
import { SectionHeading } from "@/components/public/section-heading";
import { cn } from "@/lib/utils";
import { SectionShell } from "./section-shell";
import type { SectionProps } from "./types";

const COLS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "grid-cols-2 lg:grid-cols-4" } as const;

export async function SectorsGridSection({ section, settings, locale, defaultLocale }: SectionProps<"sectors_grid">) {
  const [sectors, t] = await Promise.all([getSectors(), getTranslations()]);
  if (!sectors.length) return null;
  const x = (v: unknown) => tr(v, locale, defaultLocale);
  const id = `s-${section.id}`;

  return (
    <SectionShell labelledBy={id}>
      <SectionHeading
        id={id}
        title={x(section.title) || t("sectors.title")}
        subtitle={x(section.subtitle)}
        action={{ href: localePath(locale, "/sectors"), label: t("common.view_all") }}
      />
      <SectorCards sectors={sectors} locale={locale} defaultLocale={defaultLocale} className={COLS[settings.columns as 2 | 3 | 4]} />
    </SectionShell>
  );
}

export function SectorCards({ sectors, locale, defaultLocale, className }: {
  sectors: Awaited<ReturnType<typeof getSectors>>;
  locale: string;
  defaultLocale: string;
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-4", className)}>
      {sectors.map((s) => (
        <li key={s.id}>
          <Link
            href={localePath(locale, `/sectors/${s.slug}`)}
            className="group flex h-full flex-col items-start gap-3 rounded-theme border border-foreground/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span
              className="grid size-12 place-items-center rounded-theme bg-primary/10 text-primary"
              style={s.color ? { color: s.color, backgroundColor: `${s.color}1a` } : undefined}
            >
              <Icon icon={s.icon} fallback="layout-grid" className="size-6" />
            </span>
            <span className="font-semibold leading-snug">{tr(s.name, locale, defaultLocale)}</span>
            {tr(s.description, locale, defaultLocale) && (
              <span className="line-clamp-2 text-sm opacity-75">{tr(s.description, locale, defaultLocale)}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
