import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getPostCards, type PostDetail as Detail } from "@/lib/data/content";
import { tr, trDoc } from "@/lib/i18n/tr";
import { formatDate } from "@/lib/format";
import { KIND_PATH, localePath } from "@/lib/routes";
import { AlbumGallery } from "./album-gallery";
import { Icon } from "./icon";
import { PostCard, PostGrid } from "./post-card";
import { RichText } from "./rich-text";
import { ShareButtons } from "./share-buttons";

/** Detail page shared by activities, events and news: cover, body, album, sectors, share, related. */
export async function PostDetail({ post, locale, defaultLocale }: { post: Detail; locale: string; defaultLocale: string }) {
  const [t, siblings] = await Promise.all([getTranslations(), getPostCards(post.kind)]);
  const x = (v: unknown) => tr(v, locale, defaultLocale);
  const title = x(post.title);
  const date = post.kind === "event" ? post.event_date : post.published_at;
  const doc = trDoc(post.body, locale, defaultLocale);

  const related = siblings
    .filter((p) => p.id !== post.id)
    .map((p) => ({ p, score: p.sector_ids.filter((s) => post.sector_ids.includes(s)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ p }) => p);

  return (
    <article>
      <header className="border-b border-foreground/10 bg-primary/5">
        <div className="mx-auto max-w-4xl px-4 pb-10 pt-10 sm:px-6">
          <Link href={localePath(locale, KIND_PATH[post.kind])} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
            {t("post.back")}
          </Link>
          <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-primary">{t(`kinds.${post.kind}`)}</p>
          <h1 className="mt-2 text-balance text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 opacity-75">
            {date && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays aria-hidden className="size-4" />
                <span className="sr-only">{t("post.date")}:</span>
                <time dateTime={date}>{formatDate(date, locale)}</time>
              </span>
            )}
            {x(post.location) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden className="size-4" />
                <span className="sr-only">{t("post.location")}:</span>
                {x(post.location)}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {post.cover && (
          <div className="relative mb-10 aspect-[16/9] overflow-hidden rounded-theme">
            <Image src={post.cover.url} alt={x(post.cover.alt)} fill priority sizes="(min-width: 896px) 896px, 100vw" className="object-cover" />
          </div>
        )}
        {doc ? <RichText doc={doc} /> : x(post.excerpt) && <p className="text-lg leading-relaxed">{x(post.excerpt)}</p>}

        {post.album.length > 0 && (
          <section aria-labelledby="album" className="mt-12">
            <h2 id="album" className="mb-5 text-xl font-bold">{t("post.album", { count: post.album.length })}</h2>
            <AlbumGallery
              images={post.album.map(({ media, caption }) => ({
                src: media.url,
                alt: x(media.alt) || title,
                caption: x(caption),
                width: media.width,
                height: media.height,
              }))}
            />
          </section>
        )}

        <div className="mt-12 flex flex-col gap-6 border-t border-foreground/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          {post.sectors.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="me-1 text-sm font-medium opacity-75">{t("post.sectors")}</span>
              {post.sectors.map((s) => (
                <Link key={s.id} href={localePath(locale, `/sectors/${s.slug}`)} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 px-3 py-1 text-sm text-primary hover:bg-primary/5">
                  <Icon icon={s.icon} className="size-3.5" />
                  {x(s.name)}
                </Link>
              ))}
            </div>
          )}
          <ShareButtons title={title} />
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related" className="bg-primary/5">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 id="related" className="mb-6 text-2xl font-bold">{t("post.related")}</h2>
            <PostGrid>
              {related.map((p) => (
                <PostCard key={p.id} post={p} locale={locale} defaultLocale={defaultLocale} />
              ))}
            </PostGrid>
          </div>
        </section>
      )}
    </article>
  );
}
