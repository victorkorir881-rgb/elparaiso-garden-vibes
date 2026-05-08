// Upload helpers around the Supabase `media` storage bucket.
// Pairs with src/lib/image-optimize.ts and sql/0011_media_storage.sql.

import { supabase } from "@/integrations/supabase/client";
import { optimizeImage, makeThumbnail, type OptimizeOptions } from "./image-optimize";

const BUCKET = "media";

export type UploadResult = {
  url: string;
  thumbnailUrl: string;
  path: string;
  width: number;
  height: number;
  bytes: number;
  originalBytes: number;
};

/**
 * Optimize an image in the browser, upload it (plus a square thumbnail)
 * to the `media` bucket, and return public URLs.
 *
 * @param folder Subfolder inside the bucket, e.g. "gallery" or "menu".
 */
export async function uploadOptimizedImage(
  file: File,
  folder: string,
  opts: OptimizeOptions = {},
): Promise<UploadResult> {
  const cleanFolder = folder.replace(/^\/+|\/+$/g, "") || "uploads";
  const [main, thumb] = await Promise.all([
    optimizeImage(file, opts),
    makeThumbnail(file),
  ]);

  const mainPath = `${cleanFolder}/${main.filename}`;
  const thumbPath = `${cleanFolder}/${thumb.filename}`;

  const { error: mainErr } = await supabase.storage
    .from(BUCKET)
    .upload(mainPath, main.blob, {
      contentType: main.mime,
      cacheControl: "31536000, immutable",
      upsert: false,
    });
  if (mainErr) throw new Error(`Upload failed: ${mainErr.message}`);

  const { error: thumbErr } = await supabase.storage
    .from(BUCKET)
    .upload(thumbPath, thumb.blob, {
      contentType: thumb.mime,
      cacheControl: "31536000, immutable",
      upsert: false,
    });
  if (thumbErr) {
    // Clean up the main upload to avoid orphans.
    await supabase.storage.from(BUCKET).remove([mainPath]).catch(() => {});
    throw new Error(`Thumbnail upload failed: ${thumbErr.message}`);
  }

  const url = supabase.storage.from(BUCKET).getPublicUrl(mainPath).data.publicUrl;
  const thumbnailUrl = supabase.storage.from(BUCKET).getPublicUrl(thumbPath).data.publicUrl;

  return {
    url,
    thumbnailUrl,
    path: mainPath,
    width: main.width,
    height: main.height,
    bytes: main.optimizedSize,
    originalBytes: main.originalSize,
  };
}
