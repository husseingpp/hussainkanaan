import { cache } from "react";
import defaultLocales from "./defaults/locales.json";
import type { LocaleRow } from "./types";

// Phase 0 stub: rows mirror the future `locales` table. Phase 1 swaps this
// for a cached Supabase query (tag `locales`); callers stay unchanged.
async function fetchLocaleRows(): Promise<LocaleRow[]> {
  return defaultLocales as LocaleRow[];
}

export const getLocales = cache(async (): Promise<LocaleRow[]> => {
  const rows = await fetchLocaleRows();
  return rows.filter((l) => l.is_enabled).sort((a, b) => a.sort_order - b.sort_order);
});

export const getDefaultLocale = cache(async (): Promise<LocaleRow> => {
  const rows = await getLocales();
  const found = rows.find((l) => l.is_default) ?? rows[0];
  if (!found) throw new Error("No enabled locale configured");
  return found;
});

export async function findLocale(code: string): Promise<LocaleRow | undefined> {
  return (await getLocales()).find((l) => l.code === code);
}
