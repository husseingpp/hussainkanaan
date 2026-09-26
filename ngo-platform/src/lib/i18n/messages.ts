import { cache } from "react";
import ar from "./defaults/ar.json";
import en from "./defaults/en.json";
import type { AbstractIntlMessages } from "next-intl";
import type { UiStringRow } from "./types";

/** Code-level defaults: they seed `ui_strings` and are the final fallback. */
const defaults: Record<string, Record<string, string>> = { ar, en };

// Phase 0 stub: build `ui_strings`-shaped rows from the defaults files.
// Phase 1 replaces this with a cached Supabase query (tag `ui-strings`).
async function fetchUiStrings(): Promise<UiStringRow[]> {
  const keys = new Set(Object.values(defaults).flatMap((m) => Object.keys(m)));
  return [...keys].map((key) => ({
    key,
    value: Object.fromEntries(Object.entries(defaults).map(([code, m]) => [code, m[key]])),
  }));
}

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
    const rows = await fetchUiStrings();
    const flat: Record<string, string> = {};
    for (const { key, value } of rows) {
      flat[key] =
        value[locale] ||
        value[defaultLocale] ||
        defaults[locale]?.[key] ||
        defaults[defaultLocale]?.[key] ||
        "";
    }
    return nest(flat);
  },
);
