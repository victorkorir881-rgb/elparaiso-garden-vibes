import { createFileRoute } from "@tanstack/react-router";
import EventsPage from "@/pages/public/EventsPage";
import { OG_IMAGES } from "@/lib/og-images";
import { siteUrl } from "@/lib/site-url";
import { prefetchEvents } from "@/lib/route-prefetch";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events — Elparaiso Garden Kisii" },
      { name: "description", content: "Upcoming events, live music, themed nights and special offers." },
      { property: "og:title", content: "Events — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Upcoming events, live music, themed nights and special offers." },
      { property: "og:image", content: OG_IMAGES.events },
      { name: "twitter:image", content: OG_IMAGES.events },
    ],
    links: [{ rel: "canonical", href: siteUrl("/events") }],
  }),
  loader: () => { prefetchEvents(); },
  component: EventsPage,
});
