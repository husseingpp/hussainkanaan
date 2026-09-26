import "server-only";
import { getLocales } from "@/lib/i18n/locales";

/**
 * Static export refuses a dynamic route whose generateStaticParams() is empty.
 * Until content exists, emit one placeholder that the page turns into a 404.
 */
export const PLACEHOLDER_SLUG = "_";

export async function slugParams(slugs: string[]) {
  const list = slugs.length ? slugs : process.env.STATIC_EXPORT === "1" ? [PLACEHOLDER_SLUG] : [];
  return list.map((slug) => ({ slug }));
}

export async function localeCodes() {
  return (await getLocales()).map((l) => l.code);
}
