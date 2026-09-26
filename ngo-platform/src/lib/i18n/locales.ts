import { cache } from "react";
import { publicQuery } from "@/lib/data/query";
import { CACHE_TAGS } from "@/lib/cache";
import defaultLocales from "./defaults/locales.json";
import type { LocaleRow } from "./types";

const fetchLocaleRows = publicQuery(
  "locales",
  [CACHE_TAGS.locales],
  (db) =>
    db
      .from("locales")
      .select("code, name, dir, is_default, is_enabled, sort_order")
      .eq("is_enabled", true)
      .order("sort_order"),
  defaultLocales as LocaleRow[],
);

export const getLocales = cache(async (): Promise<LocaleRow[]> => {
  const rows = (await fetchLocaleRows()) as LocaleRow[];
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
