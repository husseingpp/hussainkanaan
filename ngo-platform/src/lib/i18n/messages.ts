import { cache } from "react";
import type { AbstractIntlMessages } from "next-intl";
import { publicQuery } from "@/lib/data/query";
import { CACHE_TAGS } from "@/lib/cache";
import ar from "./defaults/ar.json";
import en from "./defaults/en.json";

/** Code-level defaults: they seed `ui_strings` and are the final fallback. */
const defaults: Record<string, Record<string, string>> = { ar, en };

const fetchUiStrings = publicQuery(
  "ui-strings",
  [CACHE_TAGS.uiStrings],
  (db) => db.from("ui_strings").select("key, value"),
  [],
);

/** Turns flat dotted keys ("home.hero.title") into next-intl's nested shape. */
function nest(flat: Record<string, string>): AbstractIntlMessages {
  const root: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let node = root;
    parts.slice(0, -1).forEach((p) => {
      node = (node[p] ??= {}) as Record<string, unknown>;
    });
    node[parts[parts.length - 1]!] = value;
  }
  return root as AbstractIntlMessages;
}

export const loadMessages = cache(
  async (locale: string, defaultLocale: string): Promise<AbstractIntlMessages> => {
    const db = new Map<string, Record<string, unknown>>();
    for (const row of await fetchUiStrings()) {
      if (row.value && typeof row.value === "object") db.set(row.key, row.value as Record<string, unknown>);
    }
    const keys = new Set([...Object.values(defaults).flatMap(Object.keys), ...db.keys()]);
    const pick = (v: unknown) => (typeof v === "string" && v ? v : "");

    const flat: Record<string, string> = {};
    for (const key of keys) {
      const value = db.get(key);
      flat[key] =
        pick(value?.[locale]) ||
        pick(defaults[locale]?.[key]) ||
        pick(value?.[defaultLocale]) ||
        pick(defaults[defaultLocale]?.[key]);
    }
    return nest(flat);
  },
);
