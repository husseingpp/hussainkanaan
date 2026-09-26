import type { I18nText } from "./types";

/** Reads a locale map, falling back to the default locale, then to ''. */
export function tr(
  field: I18nText | null | undefined,
  locale: string,
  defaultLocale = "ar",
): string {
  if (!field) return "";
  return field[locale] || field[defaultLocale] || "";
}
