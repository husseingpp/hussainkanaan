import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { getPostCards, getSectors, type PostKind } from "@/lib/data/content";
import { getDefaultLocale } from "@/lib/i18n/locales";
import { tr } from "@/lib/i18n/tr";
import { PageHeader } from "./section-heading";
import { localePath, KIND_PATH } from "@/lib/routes";
import { PostBrowser, PostBrowserFallback } from "./post-browser";

const NS = { activity: "activities", event: "events", news: "news" } as const;
const FILTERS: Record<PostKind, ("sector" | "year")[]> = {
  activity: ["sector", "year"],
  event: ["year"],
  news: ["year"],
};

/** List page shared by /activities, /events and /news. */
export async function PostListing({ kind, locale }: { kind: PostKind; locale: string }) {
  const [t, posts, sectors, def] = await Promise.all([
    getTranslations(NS[kind]),
    getPostCards(kind),
    getSectors(),
    getDefaultLocale(),
  ]);

  const browser = {
    posts,
    sectors: sectors.map((s) => ({ id: s.id, slug: s.slug, name: tr(s.name, locale, def.code) })),
    filters: FILTERS[kind],
    locale,
    defaultLocale: def.code,
    emptyLabel: t("empty"),
    pathname: localePath(locale, KIND_PATH[kind]),
  };

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {posts.length === 0 ? (
          <p className="rounded-theme border border-dashed border-foreground/20 p-10 text-center opacity-75">{t("empty")}</p>
        ) : (
          // The fallback is the same view, unfiltered: it's the static HTML and the no-JS view.
          <Suspense fallback={<PostBrowserFallback {...browser} />}>
            <PostBrowser {...browser} />
          </Suspense>
        )}
      </div>
    </>
  );
}
