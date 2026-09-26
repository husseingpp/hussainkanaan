import Image from "next/image";
import { getMediaByIds } from "@/lib/data/content";
import { tr } from "@/lib/i18n/tr";
import { SectionHeading } from "@/components/public/section-heading";
import { SectionShell } from "./section-shell";
import type { SectionProps } from "./types";

export async function PartnersSection({ section, settings, locale, defaultLocale }: SectionProps<"partners">) {
  const logos = await getMediaByIds(settings.media_ids);
  if (!logos.length) return null;
  const x = (v: unknown) => tr(v, locale, defaultLocale);
  const id = `s-${section.id}`;

  return (
    <SectionShell labelledBy={id}>
      <SectionHeading id={id} title={x(section.title)} subtitle={x(section.subtitle)} />
      <ul className="grid grid-cols-2 items-center gap-6 sm:grid-cols-3 lg:grid-cols-6">
        {logos.map((m) => (
          <li key={m.id} className="relative h-16 opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0">
            <Image src={m.url} alt={x(m.alt)} fill sizes="200px" className="object-contain" />
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
