import type { Section } from "@/lib/data/site";
import type { SectionSettings, SectionType } from "@/lib/validation/sections";

export type SectionProps<T extends SectionType> = {
  section: Section;
  settings: SectionSettings<T>;
  locale: string;
  defaultLocale: string;
};
