import { createFileRoute } from "@tanstack/react-router";
import GalleryPage from "@/pages/public/GalleryPage";
import { OG_IMAGES } from "@/lib/og-images";
import { siteUrl } from "@/lib/site-url";
import { prefetchGallery } from "@/lib/route-prefetch";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — Elparaiso Garden Kisii" },
      { name: "description", content: "Photos of our food, venue, events and atmosphere." },
      { property: "og:title", content: "Gallery — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Photos of our food, venue, events and atmosphere." },
      { property: "og:image", content: OG_IMAGES.gallery },
      { name: "twitter:image", content: OG_IMAGES.gallery },
    ],
    links: [{ rel: "canonical", href: siteUrl("/gallery") }],
  }),
  loader: () => { prefetchGallery(); },
  component: GalleryPage,
});
