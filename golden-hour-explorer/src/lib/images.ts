import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { supabase } from "./supabase";
import { SPOT_IMAGES_BUCKET } from "./config";

/** Resize + compress a picked image before upload to keep storage/free-tier light. */
export async function compressImage(uri: string): Promise<string> {
  const result = await manipulateAsync(uri, [{ resize: { width: 1280 } }], {
    compress: 0.7,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

/** Compress, upload to the public `spot-images` bucket, return the public URL. */
export async function uploadSpotImage(uri: string, userId: string): Promise<string> {
  const compressedUri = await compressImage(uri);
  const res = await fetch(compressedUri);
  const arrayBuffer = await res.arrayBuffer();
  const path = `${userId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from(SPOT_IMAGES_BUCKET)
    .upload(path, arrayBuffer, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(SPOT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
