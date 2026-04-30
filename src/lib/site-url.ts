/**
 * Canonical site URL used for all Supabase auth redirects (email confirm,
 * password reset, OAuth callback, magic link, etc.).
 *
 * Why this exists:
 * - Production is hosted on Vercel.
 * - Local dev / Lovable preview / Vercel preview deployments must still send
 *   users back to the **production** site after confirming their email or
 *   completing OAuth, otherwise the link will land on a stale preview URL.
 * - Supabase's allow-list (Auth → URL Configuration → Redirect URLs) must
 *   include every value this can resolve to.
 *
 * Override per-environment with `VITE_SITE_URL` in Vercel / `.env`.
 */
export const SITE_URL: string =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://elparaisogardens.vercel.app";

/** Build an absolute URL on the canonical site, e.g. siteUrl("/admin"). */
export function siteUrl(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${p}`;
}
