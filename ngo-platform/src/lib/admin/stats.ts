import { createClient } from "@/lib/supabase/client";

export const STORAGE_QUOTA_BYTES = 1024 ** 3; // Supabase free tier: ~1 GB

export async function dashboardStats() {
  const db = createClient();
  const [published, drafts, media] = await Promise.all([
    db.from("posts").select("id", { count: "exact", head: true }).eq("status", "published"),
    db.from("posts").select("id", { count: "exact", head: true }).eq("status", "draft"),
    db.from("media").select("size_bytes"),
  ]);
  return {
    published: published.count ?? 0,
    drafts: drafts.count ?? 0,
    photos: media.data?.length ?? 0,
    bytes: (media.data ?? []).reduce((sum, m) => sum + (m.size_bytes ?? 0), 0),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
