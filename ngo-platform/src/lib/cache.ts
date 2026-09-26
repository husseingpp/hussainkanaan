/** Cache tags for public data (BLUEPRINT §4). Every admin write revalidates its tags. */
export const CACHE_TAGS = {
  settings: "settings",
  theme: "theme",
  nav: "nav",
  locales: "locales",
  uiStrings: "ui-strings",
  sections: "sections",
  posts: "posts",
  sectors: "sectors",
  objectives: "objectives",
  pages: "pages",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
