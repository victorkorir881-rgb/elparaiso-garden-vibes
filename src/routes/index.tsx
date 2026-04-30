import { createFileRoute } from "@tanstack/react-router";
import HomePage from "@/pages/public/HomePage";

const restaurantJsonLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Elparaiso Garden Kisii",
  "description": "Restaurant, bar, music & nightlife in Kisii. Authentic Kenyan grills, full bar, open 24/7.",
  "url": "https://elparaisogardens.vercel.app",
  "telephone": "+254700000000",
  "servesCuisine": ["Kenyan", "African", "Grill", "Barbecue"],
  "priceRange": "$$",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Kisii",
    "addressCountry": "KE",
  },
  "openingHours": "Mo-Su 00:00-23:59",
  "acceptsReservations": "True",
  "menu": "https://elparaisogardens.vercel.app/menu",
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Elparaiso Garden Kisii — Restaurant, Bar & Events" },
      { name: "description", content: "Authentic Kenyan grills, full bar, music & nightlife in Kisii. Open 24/7. Reservations, delivery & drive-through available." },
      { property: "og:title", content: "Elparaiso Garden Kisii" },
      { property: "og:description", content: "Restaurant, bar, music & nightlife in Kisii. Open 24/7." },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(restaurantJsonLd),
      },
    ],
  }),
  component: HomePage,
});
