import { siteUrl } from "@/lib/site-url";

/**
 * Per-route Open Graph / Twitter share images.
 *
 * The branded `og-image.jpg` (deep emerald + gold "E" wreath) lives in
 * `public/` so it's served from the site root. Every route uses the same
 * branded card so link previews on WhatsApp, Facebook, X, iMessage, Slack,
 * etc. all show the Elparaiso Garden logo and wordmark.
 *
 * Crawlers (Facebook, X, LinkedIn, WhatsApp) require **absolute** URLs for
 * `og:image` / `twitter:image`, so we resolve to a full canonical URL here.
 *
 * If a future route needs a different image (e.g. a specific event poster),
 * override the value for that key only — the rest stay branded.
 */
const BRAND_OG_IMAGE = siteUrl("/og-image.jpg");

export const OG_IMAGES = {
  home: BRAND_OG_IMAGE,
  menu: BRAND_OG_IMAGE,
  about: BRAND_OG_IMAGE,
  gallery: BRAND_OG_IMAGE,
  events: BRAND_OG_IMAGE,
  contact: BRAND_OG_IMAGE,
  reservations: BRAND_OG_IMAGE,
  order: BRAND_OG_IMAGE,
  track: BRAND_OG_IMAGE,
} as const;

export type OgImageKey = keyof typeof OG_IMAGES;
