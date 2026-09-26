import "server-only";
import { cache } from "react";
import { CACHE_TAGS } from "@/lib/cache";
import { DEFAULT_THEME, type Theme } from "@/lib/theme";
import { publicQuery } from "./query";
import type { Row } from "./types";

export type SiteSettings = Row<"site_settings">;
export type NavItem = Row<"nav_items"> & { children: Row<"nav_items">[] };
export type Section = Row<"page_sections">;
export type HeroSlide = Row<"hero_slides">;

export type Modules = { requests: boolean; donate: boolean; facebook_feed: boolean };

const fetchSettings = publicQuery(
  "site-settings",
  [CACHE_TAGS.settings],
  (db) => db.from("site_settings").select("*").eq("id", 1).maybeSingle(),
  null,
);

export const getSiteSettings = cache(async (): Promise<SiteSettings | null> => fetchSettings());

export async function getModules(): Promise<Modules> {
  const m = ((await getSiteSettings())?.modules ?? {}) as Partial<Modules>;
  return { requests: m.requests === true, donate: m.donate !== false, facebook_feed: m.facebook_feed === true };
}

const fetchTheme = publicQuery(
  "theme",
  [CACHE_TAGS.theme],
  (db) => db.from("theme").select("*").eq("id", 1).maybeSingle(),
  null,
);

export const getTheme = cache(async (): Promise<Theme> => {
  const row = await fetchTheme();
  if (!row) return DEFAULT_THEME;
  return {
    primary_color: row.primary_color,
    secondary_color: row.secondary_color,
    accent_color: row.accent_color,
    background_color: row.background_color,
    text_color: row.text_color,
    font_arabic: row.font_arabic as Theme["font_arabic"],
    font_latin: row.font_latin as Theme["font_latin"],
    radius: row.radius as Theme["radius"],
    header_style: row.header_style as Theme["header_style"],
    footer_style: row.footer_style as Theme["footer_style"],
  };
});

const fetchNav = publicQuery(
  "nav",
  [CACHE_TAGS.nav],
  (db) => db.from("nav_items").select("*").eq("is_active", true).order("sort_order"),
  [],
);

/** Top-level menu items with their (one level of) children. */
export const getNav = cache(async (): Promise<NavItem[]> => {
  const rows = await fetchNav();
  return rows
    .filter((r) => !r.parent_id)
    .map((r) => ({ ...r, children: rows.filter((c) => c.parent_id === r.id) }));
});

const fetchSections = publicQuery(
  "sections",
  [CACHE_TAGS.sections],
  (db, pageKey: string) =>
    db.from("page_sections").select("*").eq("page_key", pageKey).eq("is_active", true).order("sort_order"),
  [],
);

export const getSections = cache(async (pageKey: string): Promise<Section[]> => fetchSections(pageKey));

const fetchHeroSlides = publicQuery(
  "hero-slides",
  [CACHE_TAGS.sections],
  (db) => db.from("hero_slides").select("*").eq("is_active", true).order("sort_order"),
  [],
);

export const getHeroSlides = cache(async (): Promise<HeroSlide[]> => fetchHeroSlides());
