import "server-only";
import { cache } from "react";
import { CACHE_TAGS } from "@/lib/cache";
import { publicQuery } from "./query";
import type { Enum, Row } from "./types";

export type PostKind = Enum<"post_kind">;
export type Sector = Row<"sectors">;
export type Objective = Row<"objectives">;
export type Media = Row<"media">;
export type CustomPage = Row<"pages">;

export type PostCard = Pick<
  Row<"posts">,
  "id" | "kind" | "slug" | "title" | "excerpt" | "event_date" | "location" | "published_at" | "is_featured"
> & {
  cover: Pick<Media, "url" | "alt" | "width" | "height"> | null;
  sector_ids: string[];
};

export type PostDetail = PostCard &
  Pick<Row<"posts">, "body"> & {
    album: { media: Media; caption: Row<"post_media">["caption"] }[];
    sectors: Pick<Sector, "id" | "slug" | "name" | "icon" | "color">[];
  };

const CARD_FIELDS =
  "id, kind, slug, title, excerpt, event_date, location, published_at, is_featured, cover:media!posts_cover_media_id_fkey(url, alt, width, height), post_sectors(sector_id)";

type RawCard = Omit<PostCard, "sector_ids"> & { post_sectors: { sector_id: string }[] };
const toCard = ({ post_sectors, ...p }: RawCard): PostCard => ({
  ...p,
  sector_ids: post_sectors.map((s) => s.sector_id),
});

// ---------------------------------------------------------------------------

const fetchSectors = publicQuery(
  "sectors",
  [CACHE_TAGS.sectors],
  (db) => db.from("sectors").select("*").eq("is_active", true).order("sort_order"),
  [],
);
export const getSectors = cache(async (): Promise<Sector[]> => fetchSectors());

export async function getSector(slug: string): Promise<Sector | undefined> {
  return (await getSectors()).find((s) => s.slug === slug);
}

const fetchObjectives = publicQuery(
  "objectives",
  [CACHE_TAGS.objectives],
  (db) => db.from("objectives").select("*").eq("is_active", true).order("sort_order"),
  [],
);
export const getObjectives = cache(async (): Promise<Objective[]> => fetchObjectives());

// ---------------------------------------------------------------------------

const fetchPostCards = publicQuery(
  "post-cards",
  [CACHE_TAGS.posts],
  (db, kind: PostKind) => {
    const q = db.from("posts").select(CARD_FIELDS).eq("kind", kind).eq("status", "published");
    return kind === "event"
      ? q.order("event_date", { ascending: false, nullsFirst: false }).order("published_at", { ascending: false })
      : q.order("published_at", { ascending: false });
  },
  [],
);

/** Published posts of one kind, newest first (events by event date). */
export const getPostCards = cache(async (kind: PostKind): Promise<PostCard[]> =>
  ((await fetchPostCards(kind)) as unknown as RawCard[]).map(toCard),
);

const fetchPost = publicQuery(
  "post",
  [CACHE_TAGS.posts],
  (db, kind: PostKind, slug: string) =>
    db
      .from("posts")
      .select(
        `${CARD_FIELDS}, body, post_media(sort_order, caption, media(*)), sectors(id, slug, name, icon, color)`,
      )
      .eq("kind", kind)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle(),
  null,
);

export const getPost = cache(async (kind: PostKind, slug: string): Promise<PostDetail | null> => {
  const raw = (await fetchPost(kind, slug)) as unknown as
    | (RawCard & {
        body: Row<"posts">["body"];
        post_media: { sort_order: number; caption: Row<"post_media">["caption"]; media: Media }[];
        sectors: PostDetail["sectors"];
      })
    | null;
  if (!raw) return null;
  const { post_media, sectors, body, ...card } = raw;
  return {
    ...toCard(card),
    body,
    sectors: [...sectors],
    album: [...post_media]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(({ media, caption }) => ({ media, caption })),
  };
});

// ---------------------------------------------------------------------------

const fetchPages = publicQuery(
  "pages",
  [CACHE_TAGS.pages],
  (db) => db.from("pages").select("*").eq("status", "published").order("created_at"),
  [],
);
export const getPages = cache(async (): Promise<CustomPage[]> => fetchPages());

export async function getPage(slug: string): Promise<CustomPage | undefined> {
  return (await getPages()).find((p) => p.slug === slug);
}

const fetchMedia = publicQuery(
  "media",
  [CACHE_TAGS.posts],
  (db, ids: string[]) => db.from("media").select("*").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
  [],
);

/** Media rows in the order the ids were given. */
export async function getMediaByIds(ids: string[]): Promise<Media[]> {
  if (!ids.length) return [];
  const rows = await fetchMedia(ids);
  return ids.map((id) => rows.find((m) => m.id === id)).filter((m): m is Media => Boolean(m));
}

const fetchAlbum = publicQuery(
  "album",
  [CACHE_TAGS.posts],
  (db, postId: string) => db.from("post_media").select("sort_order, caption, media(*)").eq("post_id", postId).order("sort_order"),
  [],
);

/** A published post's album (RLS hides albums of drafts). */
export async function getAlbum(postId: string): Promise<PostDetail["album"]> {
  const rows = (await fetchAlbum(postId)) as unknown as { caption: Row<"post_media">["caption"]; media: Media }[];
  return rows.map(({ media, caption }) => ({ media, caption }));
}
