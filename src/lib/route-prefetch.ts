// Route-level prefetchers. Each function primes the React Query cache with
// the queries the matching page renders on first paint, so when the user
// hovers / scrolls a link into view (defaultPreload: "viewport"), the data
// is already loaded by the time the route mounts.
//
// Each prefetcher mirrors EXACTLY the queryKey + queryFn used by the page's
// hook in src/lib/supabase-hooks.ts. If you change a hook's key/fn, mirror
// the change here too.

import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/router";

const STALE = 5 * 60 * 1000; // align with router defaultPreloadStaleTime / query staleTime

function prefetch<T>(queryKey: unknown[], queryFn: () => Promise<T>) {
  // fire-and-forget; React Query dedupes if the same key is in flight
  return queryClient.prefetchQuery({ queryKey, queryFn, staleTime: STALE });
}

// ── individual primitives, mirroring supabase-hooks.ts ──────────────────────

const fetchSettings = async () => {
  const { data, error } = await supabase.from("site_settings").select("*");
  if (error) throw error;
  const map: Record<string, string> = {};
  (data ?? []).forEach((r: any) => { map[r.key] = r.value ?? ""; });
  return map;
};

const fetchMenuCategories = async (activeOnly: boolean) => {
  let q = supabase.from("menu_categories").select("*").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
};

const fetchMenuItems = async (opts?: { categoryId?: string; featuredOnly?: boolean; availableOnly?: boolean; search?: string }) => {
  let q = supabase.from("menu_items").select("*").order("sort_order").order("name");
  if (opts?.categoryId) q = q.eq("category_id", opts.categoryId);
  if (opts?.featuredOnly) q = q.eq("is_featured", true);
  if (opts?.availableOnly) q = q.eq("is_available", true);
  if (opts?.search) q = q.ilike("name", `%${opts.search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
};

const fetchEvents = async (opts?: { activeOnly?: boolean }) => {
  let q = supabase.from("events").select("*").order("created_at", { ascending: false });
  if (opts?.activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
};

const fetchGalleryImages = async (opts?: { category?: string; featuredOnly?: boolean }) => {
  let q = supabase.from("gallery_images").select("*").order("sort_order").order("created_at", { ascending: false });
  if (opts?.category && opts.category !== "All") q = q.eq("category", opts.category);
  if (opts?.featuredOnly) q = q.eq("is_featured", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
};

const fetchReviews = async (featuredOnly: boolean) => {
  let q = supabase.from("reviews").select("*").order("created_at", { ascending: false });
  if (featuredOnly) q = q.eq("is_featured", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
};

// ── per-route prefetchers ───────────────────────────────────────────────────

export function prefetchHome() {
  return Promise.all([
    prefetch(["settings"], fetchSettings),
    prefetch(["menuItems", { featuredOnly: true, availableOnly: true }], () => fetchMenuItems({ featuredOnly: true, availableOnly: true })),
    prefetch(["events", { activeOnly: true }], () => fetchEvents({ activeOnly: true })),
    prefetch(["gallery", { featuredOnly: true }], () => fetchGalleryImages({ featuredOnly: true })),
    prefetch(["reviews", true], () => fetchReviews(true)),
  ]);
}

export function prefetchMenu() {
  return Promise.all([
    prefetch(["menuCategories", true], () => fetchMenuCategories(true)),
    prefetch(["menuItems", { availableOnly: true }], () => fetchMenuItems({ availableOnly: true })),
  ]);
}

export function prefetchEvents() {
  return prefetch(["events", { activeOnly: true }], () => fetchEvents({ activeOnly: true }));
}

export function prefetchGallery() {
  // GalleryPage initial render: { category: undefined }
  return prefetch(["gallery", { category: undefined }], () => fetchGalleryImages({ category: undefined }));
}

export function prefetchSettings() {
  return prefetch(["settings"], fetchSettings);
}
