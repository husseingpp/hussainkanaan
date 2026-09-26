import type { Section } from "@/lib/data/site";
import type { SectionType } from "@/lib/validation/sections";
import { sectionRegistry } from "./registry";
import type { SectionProps } from "./types";

/** Renders an ordered list of page_sections. Invalid settings fall back to schema defaults. */
export function SectionRenderer({ sections, locale, defaultLocale }: { sections: Section[]; locale: string; defaultLocale: string }) {
  return sections.map((section) => {
    const entry = sectionRegistry[section.section_type as SectionType];
    if (!entry) return null;
    const parsed = entry.schema.safeParse(section.settings ?? {});
    const settings = parsed.success ? parsed.data : entry.schema.parse({});
    const Component = entry.Component as React.ComponentType<SectionProps<SectionType>>;
    return <Component key={section.id} section={section} settings={settings} locale={locale} defaultLocale={defaultLocale} />;
  });
}
