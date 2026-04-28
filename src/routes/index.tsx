import { createFileRoute } from "@tanstack/react-router";
import HomePage from "@/pages/public/HomePage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Elparaiso Garden Kisii — Restaurant, Bar & Events" },
      { name: "description", content: "Authentic Kenyan grills, full bar, music & nightlife in Kisii. Open 24/7. Reservations, delivery & drive-through available." },
      { property: "og:title", content: "Elparaiso Garden Kisii" },
      { property: "og:description", content: "Restaurant, bar, music & nightlife in Kisii. Open 24/7." },
    ],
  }),
  component: HomePage,
});
