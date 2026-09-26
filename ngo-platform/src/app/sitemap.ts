import type { MetadataRoute } from "next";
import { getPages, getPostCards, getSectors } from "@/lib/data/content";
import { getLocales } from "@/lib/i18n/locales";
import { KIND_PATH } from "@/lib/routes";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

/** One entry per page with every enabled locale as an hreflang alternate. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [locales, sectors, pages, activity, event, news] = await Promise.all([
    getLocales(),
    getSectors(),
    getPages(),
    getPostCards("activity"),
    getPostCards("event"),
    getPostCards("news"),
  ]);

  const paths = [
    "",
    "/activities",
    "/events",
    "/news",
    "/sectors",
    "/objectives",
    "/contact",
    "/privacy",
    ...sectors.map((s) => `/sectors/${s.slug}`),
    ...pages.map((p) => `/p/${p.slug}`),
    ...[...activity, ...event, ...news].map((p) => `${KIND_PATH[p.kind]}/${p.slug}`),
  ];

  return paths.flatMap((path) =>
    locales.map((l) => ({
      url: absoluteUrl(`/${l.code}${path}`),
      alternates: { languages: Object.fromEntries(locales.map((o) => [o.code, absoluteUrl(`/${o.code}${path}`)])) },
    })),
  );
}
