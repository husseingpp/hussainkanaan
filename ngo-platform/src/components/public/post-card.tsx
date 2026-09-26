import Link from "next/link";
import Image from "next/image";
import { CalendarDays, ImageIcon, MapPin } from "lucide-react";
import { tr } from "@/lib/i18n/tr";
import { formatDate } from "@/lib/format";
import { postPath } from "@/lib/routes";
import type { PostCard as Card } from "@/lib/data/content";

type Props = {
  post: Card;
  locale: string;
  defaultLocale: string;
  kindLabel?: string;
  priority?: boolean;
  /** Heading level for the title: 2 on list pages directly under the h1, else 3. */
  headingLevel?: 2 | 3;
};

/** Shared by server listings and the client-side filter browser (no server-only imports). */
export function PostCard({ post, locale, defaultLocale, kindLabel, priority, headingLevel = 3 }: Props) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const title = tr(post.title, locale, defaultLocale);
  const excerpt = tr(post.excerpt, locale, defaultLocale);
  const date = post.kind === "event" ? post.event_date : post.published_at;
  const location = tr(post.location, locale, defaultLocale);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-theme border border-foreground/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[16/10] overflow-hidden bg-primary/10">
        {post.cover ? (
          <Image
            src={post.cover.url}
            alt={tr(post.cover.alt, locale, defaultLocale)}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-primary/40">
            <ImageIcon aria-hidden className="size-10" />
          </div>
        )}
        {kindLabel && (
          <span className="absolute start-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium">
            {kindLabel}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-70">
          {date && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays aria-hidden className="size-4" />
              <time dateTime={date}>{formatDate(date, locale)}</time>
            </span>
          )}
          {location && (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden className="size-4" />
              {location}
            </span>
          )}
        </div>
        <Heading className="mt-2 text-lg font-semibold leading-snug">
          <Link href={postPath(locale, post.kind, post.slug)} className="after:absolute after:inset-0 focus-visible:outline-none">
            {title}
          </Link>
        </Heading>
        {excerpt && <p className="mt-2 line-clamp-3 leading-relaxed opacity-80">{excerpt}</p>}
      </div>
    </article>
  );
}

export function PostGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
