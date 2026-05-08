/**
 * Per-route Open Graph / Twitter share images.
 *
 * Each entry is the absolute URL of the image used for `og:image` and
 * `twitter:image` on that route. Until the gallery has curated brand assets,
 * we reuse the same Unsplash photos that appear on the page itself so the
 * social preview matches what the visitor sees.
 *
 * Replace any of these with real branded photos from Supabase storage when
 * the team uploads them — keep the keys identical so route files don't need
 * to change.
 */
export const OG_IMAGES = {
  home: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&h=630&fit=crop&q=80",
  menu: "https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&h=630&fit=crop&q=80",
  about: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&h=630&fit=crop&q=80",
  gallery: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=1200&h=630&fit=crop&q=80",
  events: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1200&h=630&fit=crop&q=80",
  contact: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=630&fit=crop&q=80",
  reservations: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&h=630&fit=crop&q=80",
  order: "https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&h=630&fit=crop&q=80",
  track: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=630&fit=crop&q=80",
} as const;

export type OgImageKey = keyof typeof OG_IMAGES;
