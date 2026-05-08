import { createFileRoute } from "@tanstack/react-router";
import OrderTrackingPage from "@/pages/public/OrderTrackingPage";
import { OG_IMAGES } from "@/lib/og-images";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track Your Order — Elparaiso Garden Kisii" },
      { name: "description", content: "Track your delivery or takeaway order by phone number." },
      { property: "og:title", content: "Track Your Order — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Track your delivery or takeaway order by phone number." },
      { property: "og:image", content: OG_IMAGES.track },
      { name: "twitter:image", content: OG_IMAGES.track },
    ],
    links: [{ rel: "canonical", href: siteUrl("/track") }],
  }),
  component: OrderTrackingPage,
});
