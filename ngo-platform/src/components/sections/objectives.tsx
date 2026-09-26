import { getTranslations } from "next-intl/server";
import { getObjectives, getSectors } from "@/lib/data/content";
import { tr } from "@/lib/i18n/tr";
import { localePath } from "@/lib/routes";
import { Icon } from "@/components/public/icon";
import { SectionHeading } from "@/components/public/section-heading";
import { cn } from "@/lib/utils";
import { SectionShell } from "./section-shell";
import type { SectionProps } from "./types";

export async function ObjectivesSection({ section, settings, locale, defaultLocale }: SectionProps<"objectives">) {
  const [objectives, sectors, t] = await Promise.all([getObjectives(), getSectors(), getTranslations()]);
  if (!objectives.length) return null;
  const x = (v: unknown) => tr(v, locale, defaultLocale);
  const id = `s-${section.id}`;
  const sectorIcon = (sid: string | null) => sectors.find((s) => s.id === sid)?.icon;

  return (
    <SectionShell tone="tinted" labelledBy={id}>
      <SectionHeading
        id={id}
        title={x(section.title) || t("objectives.title")}
        subtitle={x(section.subtitle)}
        action={{ href: localePath(locale, "/objectives"), label: t("common.view_all") }}
      />
      <ol className={cn(settings.layout === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3")}>
        {objectives.map((o, i) => (
          <li key={o.id} className="flex gap-4 rounded-theme bg-white p-5 shadow-sm">
            {settings.show_icons ? (
              <span className="grid size-11 shrink-0 place-items-center rounded-theme bg-primary/10 text-primary">
                <Icon icon={o.icon ?? sectorIcon(o.sector_id)} fallback="target" className="size-5" />
              </span>
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
            )}
            <p className="leading-relaxed">{x(o.text)}</p>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}
