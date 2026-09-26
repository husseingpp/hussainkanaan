import type { I18nText } from "./types";

function isLocaleMap(value: unknown): value is I18nText {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads a locale map, falling back to the default locale, then to ''. */
export function tr(field: unknown, locale: string, defaultLocale = "ar"): string {
  if (!isLocaleMap(field)) return "";
  const pick = (code: string) => {
    const v = field[code];
    return typeof v === "string" ? v : "";
  };
  return pick(locale) || pick(defaultLocale);
}

/** Like tr() but for rich-text (Tiptap JSON) locale maps. */
export function trDoc(field: unknown, locale: string, defaultLocale = "ar"): unknown {
  if (!isLocaleMap(field)) return null;
  const map = field as Record<string, unknown>;
  const has = (code: string) => map[code] != null && JSON.stringify(map[code]) !== "{}";
  if (has(locale)) return map[locale];
  if (has(defaultLocale)) return map[defaultLocale];
  return null;
}
