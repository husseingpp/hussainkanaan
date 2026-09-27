import { createClient } from "@/lib/supabase/client";
import type { Row } from "@/lib/data/types";
import { postSchema, type PostInput } from "@/lib/validation/content";
import type { Media } from "./media";
import { errorKey, fail, ok, validate, type Result } from "./result";

export type PostRow = Row<"posts">;
export type PostListItem = Pick<PostRow, "id" | "kind" | "slug" | "title" | "status" | "is_featured" | "published_at" | "event_date" | "updated_at"> & {
  cover: Pick<Media, "url"> | null;
  photos: { count: number }[];
};
export type EditablePost = PostInput & { album_media: Media[]; cover: Media | null };

export async function listPosts(kind?: PostRow["kind"]): Promise<Result<PostListItem[]>> {
  let q = createClient()
    .from("posts")
    .select("id, kind, slug, title, status, is_featured, published_at, event_date, updated_at, cover:media!posts_cover_media_id_fkey(url), photos:post_media(count)")
    .order("updated_at", { ascending: false });
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  return error ? fail(errorKey(error)) : ok(data as unknown as PostListItem[]);
}

export async function loadPost(id: string): Promise<Result<EditablePost>> {
  const { data, error } = await createClient()
    .from("posts")
    .select("*, cover:media!posts_cover_media_id_fkey(*), post_sectors(sector_id), post_media(sort_order, caption, media(*))")
    .eq("id", id)
    .maybeSingle();
  if (error) return fail(errorKey(error));
  if (!data) return fail("not_found");
  const raw = data as unknown as PostRow & {
    cover: Media | null;
    post_sectors: { sector_id: string }[];
    post_media: { sort_order: number; caption: Record<string, string>; media: Media }[];
  };
  const album = [...raw.post_media].sort((a, b) => a.sort_order - b.sort_order);
  return ok({
    id: raw.id,
    kind: raw.kind,
    slug: raw.slug,
    title: (raw.title ?? {}) as Record<string, string>,
    excerpt: (raw.excerpt ?? {}) as Record<string, string>,
    body: (raw.body ?? {}) as Record<string, unknown>,
    cover_media_id: raw.cover_media_id,
    cover: raw.cover,
    event_date: raw.event_date,
    location: (raw.location ?? null) as Record<string, string> | null,
    status: raw.status,
    is_featured: raw.is_featured,
    sector_ids: raw.post_sectors.map((s) => s.sector_id),
    album: album.map((a) => ({ media_id: a.media.id, caption: a.caption ?? {} })),
    album_media: album.map((a) => a.media),
  });
}

export async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  let q = createClient().from("posts").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (exceptId) q = q.neq("id", exceptId);
  const { count } = await q;
  return (count ?? 0) > 0;
}

/** Saves the post, then replaces its sector links and album in one transaction (set_post_links). */
export async function savePost(input: PostInput): Promise<Result<{ id: string }>> {
  const v = validate(postSchema, input);
  if (!v.ok) return v;
  const p = v.data;
  const db = createClient();
  const row = {
    kind: p.kind,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    body: p.body as PostRow["body"],
    cover_media_id: p.cover_media_id,
    event_date: p.kind === "event" ? p.event_date : null,
    location: p.kind === "event" ? p.location : null,
    status: p.status,
    is_featured: p.is_featured,
  };
  const saved = p.id
    ? await db.from("posts").update(row).eq("id", p.id).select("id").single()
    : await db.from("posts").insert(row).select("id").single();
  if (saved.error) return fail(errorKey(saved.error));
  const id = saved.data.id;

  const links = await db.rpc("set_post_links", {
    p_post_id: id,
    p_sector_ids: p.sector_ids,
    p_album: p.album.map((a) => ({ media_id: a.media_id, caption: a.caption })),
  });
  if (links.error) return fail(errorKey(links.error));
  return ok({ id });
}

export async function deletePost(id: string): Promise<Result<null>> {
  const { error } = await createClient().from("posts").delete().eq("id", id);
  return error ? fail(errorKey(error)) : ok(null);
}
