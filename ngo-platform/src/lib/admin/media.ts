import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import type { Row } from "@/lib/data/types";
import { errorKey, fail, ok, type Result } from "./result";

export type Media = Row<"media">;
const BUCKET = "public-images";

/** Blueprint rule 12: compress client-side to WebP, max 1600px, then register in `media`. */
export async function uploadImage(file: File, onProgress?: (pct: number) => void): Promise<Result<Media>> {
  if (!file.type.startsWith("image/")) return fail("not_image");
  const db = createClient();
  try {
    const isSvg = file.type === "image/svg+xml";
    const out = isSvg
      ? file
      : await imageCompression(file, {
          maxWidthOrHeight: 1600,
          fileType: "image/webp",
          initialQuality: 0.8,
          maxSizeMB: 1,
          useWebWorker: true,
          onProgress: (p) => onProgress?.(Math.round(p * 0.8)),
        });
    const { width, height } = isSvg ? { width: null, height: null } : await dimensions(out);
    const ext = isSvg ? "svg" : "webp";
    const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
    const up = await db.storage.from(BUCKET).upload(path, out, { contentType: isSvg ? file.type : "image/webp", cacheControl: "31536000" });
    if (up.error) return fail(errorKey({ message: up.error.message }));
    onProgress?.(90);
    const url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const { data, error } = await db
      .from("media")
      .insert({ storage_path: path, url, width, height, size_bytes: out.size, alt: {} })
      .select()
      .single();
    if (error) return fail(errorKey(error));
    onProgress?.(100);
    return ok(data);
  } catch {
    return fail("upload_failed");
  }
}

function dimensions(blob: Blob): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || null, height: img.naturalHeight || null });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve({ width: null, height: null });
    img.src = URL.createObjectURL(blob);
  });
}

export async function listMedia(): Promise<Result<Media[]>> {
  const { data, error } = await createClient().from("media").select("*").order("created_at", { ascending: false });
  return error ? fail(errorKey(error)) : ok(data);
}

export async function updateAlt(id: string, alt: Record<string, string>): Promise<Result<null>> {
  const { error } = await createClient().from("media").update({ alt }).eq("id", id);
  return error ? fail(errorKey(error)) : ok(null);
}

/** Where a media item is used (albums and covers). Empty = safe to delete. */
export async function mediaUsage(id: string, url: string): Promise<Result<number>> {
  const db = createClient();
  const [album, covers, slides, sectors, pages] = await Promise.all([
    db.from("post_media").select("post_id", { count: "exact", head: true }).eq("media_id", id),
    db.from("posts").select("id", { count: "exact", head: true }).eq("cover_media_id", id),
    db.from("hero_slides").select("id", { count: "exact", head: true }).eq("image_url", url),
    db.from("sectors").select("id", { count: "exact", head: true }).eq("cover_image", url),
    db.from("pages").select("id", { count: "exact", head: true }).eq("cover_image", url),
  ]);
  const failed = [album, covers, slides, sectors, pages].find((r) => r.error);
  if (failed?.error) return fail(errorKey(failed.error));
  return ok([album, covers, slides, sectors, pages].reduce((n, r) => n + (r.count ?? 0), 0));
}

export async function deleteMedia(m: Media): Promise<Result<null>> {
  const usage = await mediaUsage(m.id, m.url);
  if (!usage.ok) return usage;
  if (usage.data > 0) return fail("in_use");
  const db = createClient();
  const { error } = await db.from("media").delete().eq("id", m.id);
  if (error) return fail(errorKey(error));
  await db.storage.from(BUCKET).remove([m.storage_path]);
  return ok(null);
}
