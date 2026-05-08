// Browser-side image optimization: resize + WebP encoding via canvas.
// No native deps — runs entirely in the user's browser before upload.

export type OptimizeOptions = {
  /** Max edge length in pixels. Aspect ratio preserved. Default 1600. */
  maxEdge?: number;
  /** WebP quality 0..1. Default 0.82. */
  quality?: number;
  /** Output mime: 'image/webp' (default) or 'image/jpeg'. */
  mime?: "image/webp" | "image/jpeg";
};

export type OptimizedImage = {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
  mime: string;
  /** Suggested filename (without folder), e.g. `1738012345-abc123.webp`. */
  filename: string;
};

const ALLOWED_INPUT = /^image\/(jpeg|png|webp|gif|avif|heic|heif)$/i;

export async function optimizeImage(
  file: File,
  opts: OptimizeOptions = {},
): Promise<OptimizedImage> {
  if (!ALLOWED_INPUT.test(file.type)) {
    throw new Error(`Unsupported image type: ${file.type || "unknown"}`);
  }
  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.82;
  const mime = opts.mime ?? "image/webp";

  const bitmap = await loadBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, quality),
  );
  if (!blob) throw new Error("Image encoding failed");

  const ext = mime === "image/webp" ? "webp" : "jpg";
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const filename = `${stamp}-${rand}.${ext}`;

  return {
    blob,
    width,
    height,
    originalSize: file.size,
    optimizedSize: blob.size,
    mime,
    filename,
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap handles EXIF orientation for jpegs in modern browsers.
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // fall through to <img> fallback
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Failed to decode image"));
      i.src = url;
    });
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fitWithin(w: number, h: number, maxEdge: number) {
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / longest;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/** Convenience: also produce a square thumbnail (default 400px). */
export async function makeThumbnail(
  file: File,
  size = 400,
  quality = 0.78,
): Promise<OptimizedImage> {
  const bitmap = await loadBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) throw new Error("Thumbnail encoding failed");

  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return {
    blob,
    width: size,
    height: size,
    originalSize: file.size,
    optimizedSize: blob.size,
    mime: "image/webp",
    filename: `${stamp}-${rand}-thumb.webp`,
  };
}
