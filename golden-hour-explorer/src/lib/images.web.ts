import { supabase } from "./supabase";
import { SPOT_IMAGES_BUCKET } from "./config";

/**
 * Web image upload. Mirrors the native images.ts surface, but skips
 * expo-image-manipulator (browser-unreliable) — the browser already hands us a
 * reasonably sized blob from the file picker. Reads the blob:/data: URI, uploads
 * it to the public `spot-images` bucket, and returns the public URL.
 */
export async function compressImage(uri: string): Promise<string> {
  // No-op on web; kept so callers can import the same name on every platform.
  return uri;
}

export async function uploadSpotImage(uri: string, userId: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const contentType = blob.type || "image/jpeg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(SPOT_IMAGES_BUCKET)
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(SPOT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
