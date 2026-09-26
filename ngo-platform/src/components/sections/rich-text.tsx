import { tr, trDoc } from "@/lib/i18n/tr";
import { RichText } from "@/components/public/rich-text";
import { SectionHeading } from "@/components/public/section-heading";
import { SectionShell } from "./section-shell";
import type { SectionProps } from "./types";

export function RichTextSection({ section, settings, locale, defaultLocale }: SectionProps<"rich_text">) {
  const doc = trDoc(settings.body, locale, defaultLocale);
  if (!doc) return null;
  const id = `s-${section.id}`;
  return (
    <SectionShell labelledBy={id}>
      <div className="mx-auto max-w-3xl">
        <SectionHeading id={id} title={tr(section.title, locale, defaultLocale)} subtitle={tr(section.subtitle, locale, defaultLocale)} />
        <RichText doc={doc} />
      </div>
    </SectionShell>
  );
}
