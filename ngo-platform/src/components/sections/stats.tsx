import { tr } from "@/lib/i18n/tr";
import { Icon } from "@/components/public/icon";
import { SectionHeading } from "@/components/public/section-heading";
import { SectionShell } from "./section-shell";
import type { SectionProps } from "./types";

export function StatsSection({ section, settings, locale, defaultLocale }: SectionProps<"stats">) {
  if (!settings.items.length) return null;
  const x = (v: unknown) => tr(v, locale, defaultLocale);
  const id = `s-${section.id}`;

  return (
    <SectionShell labelledBy={id}>
      <SectionHeading id={id} title={x(section.title)} subtitle={x(section.subtitle)} />
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {settings.items.map((item, i) => (
          <div key={i} className="flex flex-col items-center rounded-theme border border-foreground/10 bg-white p-6 text-center">
            {item.icon && <Icon icon={item.icon} className="mb-2 size-7 text-secondary" />}
            <dt className="order-2 mt-1 text-sm opacity-75">{x(item.label)}</dt>
            <dd className="order-1 text-3xl font-bold text-primary sm:text-4xl" dir="ltr">{item.value}</dd>
          </div>
        ))}
      </dl>
    </SectionShell>
  );
}
