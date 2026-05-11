import { createFileRoute } from "@tanstack/react-router";
import ReservationsPage from "@/pages/public/ReservationsPage";
import { OG_IMAGES } from "@/lib/og-images";
import { siteUrl } from "@/lib/site-url";
import { prefetchSettings } from "@/lib/route-prefetch";

export const Route = createFileRoute("/reservations")({
  head: () => ({
    meta: [
      { title: "Reservations — Elparaiso Garden Kisii" },
      { name: "description", content: "Reserve a table for dining, drinks or events." },
      { property: "og:title", content: "Reservations — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Reserve a table for dining, drinks or events." },
      { property: "og:image", content: OG_IMAGES.reservations },
      { name: "twitter:image", content: OG_IMAGES.reservations },
    ],
    links: [{ rel: "canonical", href: siteUrl("/reservations") }],
  }),
  loader: () => { prefetchSettings(); },
  component: ReservationsPage,
});
