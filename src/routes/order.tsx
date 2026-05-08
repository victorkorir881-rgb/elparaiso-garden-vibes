import { createFileRoute } from "@tanstack/react-router";
import OrderPage from "@/pages/public/OrderPage";
import { OG_IMAGES } from "@/lib/og-images";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/order")({
  head: () => ({
    meta: [
      { title: "Order Online — Elparaiso Garden Kisii" },
      { name: "description", content: "Order food and drinks online for delivery or pickup." },
      { property: "og:title", content: "Order Online — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Order food and drinks online for delivery or pickup." },
      { property: "og:image", content: OG_IMAGES.order },
      { name: "twitter:image", content: OG_IMAGES.order },
    ],
    links: [{ rel: "canonical", href: siteUrl("/order") }],
  }),
  component: OrderPage,
});
