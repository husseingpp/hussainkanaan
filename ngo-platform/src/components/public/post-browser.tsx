"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PostCard as Card } from "@/lib/data/content";
import { yearOf } from "@/lib/format";
import { PostCard, PostGrid } from "./post-card";

export const PAGE_SIZE = 9;

const dateOf = (p: Card) => (p.kind === "event" ? p.event_date : p.published_at);

type Props = {
  posts: Card[];
  sectors: { id: string; slug: string; name: string }[];
  filters: ("sector" | "year")[];
  locale: string;
  defaultLocale: string;
  emptyLabel: string;
  pathname: string;
};

/** Client-side filtering + pagination (?sector=&year=&page=), so it also works on static hosting. */
export function PostBrowser(props: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() || props.pathname;
  return <PostBrowserView {...props} pathname={pathname} params={params} navigate={(href) => router.replace(href, { scroll: false })} />;
}

/** Unfiltered first page with the same layout, used before the URL is known (no layout shift). */
export function PostBrowserFallback(props: Props) {
  return <PostBrowserView {...props} params={new URLSearchParams()} navigate={() => {}} />;
}

function PostBrowserView({
  posts,
  sectors,
  filters,
  locale,
  defaultLocale,
  emptyLabel,
  pathname,
  params,
  navigate,
}: Props & { params: Pick<URLSearchParams, "get" | "toString">; navigate: (href: string) => void }) {
  const t = useTranslations();

  const sector = sectors.find((s) => s.slug === params.get("sector"));
  const year = params.get("year");

  const years = useMemo(
    () => [...new Set(posts.map((p) => yearOf(dateOf(p))).filter(Boolean) as string[])].sort().reverse(),
    [posts],
  );
  const usedSectors = sectors.filter((s) => posts.some((p) => p.sector_ids.includes(s.id)));

  const filtered = posts.filter(
    (p) => (!sector || p.sector_ids.includes(sector.id)) && (!year || yearOf(dateOf(p)) === year),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(params.get("page")) || 1), pages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hrefWith = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const q = next.toString();
    return q ? `${pathname}?${q}` : pathname;
  };
  const set = (k: string, v: string) => navigate(hrefWith({ [k]: v || null, page: null }));

  if (!posts.length) return <p className="rounded-theme border border-dashed border-foreground/20 p-10 text-center opacity-75">{emptyLabel}</p>;

  const select = "h-10 rounded-theme border border-foreground/20 bg-white px-3 text-sm";
  const showSector = filters.includes("sector") && usedSectors.length > 0;
  const showYear = filters.includes("year") && years.length > 1;

  return (
    <div>
      {(showSector || showYear) && (
        <form role="search" aria-label={t("filters.label")} className="mb-8 flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()}>
          {showSector && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("filters.sector")}
              <select className={select} value={sector?.slug ?? ""} onChange={(e) => set("sector", e.target.value)}>
                <option value="">{t("filters.all_sectors")}</option>
                {usedSectors.map((s) => (
                  <option key={s.id} value={s.slug}>{s.name}</option>
                ))}
              </select>
            </label>
          )}
          {showYear && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("filters.year")}
              <select className={select} value={year ?? ""} onChange={(e) => set("year", e.target.value)}>
                <option value="">{t("filters.all_years")}</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
          )}
          {(sector || year) && (
            <Link href={pathname} scroll={false} className="h-10 px-2 text-sm leading-10 text-primary underline">
              {t("filters.clear")}
            </Link>
          )}
        </form>
      )}

      {visible.length ? (
        <PostGrid>
          {visible.map((p, i) => (
            <PostCard key={p.id} post={p} locale={locale} defaultLocale={defaultLocale} priority={i < 3} headingLevel={2} />
          ))}
        </PostGrid>
      ) : (
        <p className="rounded-theme border border-dashed border-foreground/20 p-10 text-center opacity-75">{t("filters.no_match")}</p>
      )}

      {pages > 1 && (
        <nav aria-label={t("common.page_of", { page, total: pages })} className="mt-10 flex items-center justify-center gap-3">
          <Link
            aria-disabled={page === 1}
            href={hrefWith({ page: page > 2 ? String(page - 1) : null })}
            className="inline-flex items-center gap-1 rounded-theme border border-foreground/20 px-4 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
            {t("common.previous")}
          </Link>
          <span className="text-sm opacity-75">{t("common.page_of", { page, total: pages })}</span>
          <Link
            aria-disabled={page === pages}
            href={hrefWith({ page: String(page + 1) })}
            className="inline-flex items-center gap-1 rounded-theme border border-foreground/20 px-4 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            {t("common.next")}
            <ChevronRight aria-hidden className="size-4 rtl:rotate-180" />
          </Link>
        </nav>
      )}
    </div>
  );
}
