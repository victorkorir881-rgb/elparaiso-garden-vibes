import { createFileRoute } from "@tanstack/react-router";
import MenuPage from "@/pages/public/MenuPage";
import { OG_IMAGES } from "@/lib/og-images";
import { siteUrl } from "@/lib/site-url";
import { prefetchMenu } from "@/lib/route-prefetch";

const menuJsonLd = {
  "@context": "https://schema.org",
  "@type": "Menu",
  "name": "Elparaiso Garden Kisii Menu",
  "description": "Full menu of nyama choma, grills, drinks and more.",
  "url": "https://elparaisogardens.vercel.app/menu",
  "inLanguage": "en",
};

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu — Elparaiso Garden Kisii" },
      { name: "description", content: "Browse our full menu of nyama choma, grills, drinks and more." },
      { property: "og:title", content: "Menu — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Browse our full menu of nyama choma, grills, drinks and more." },
      { property: "og:image", content: OG_IMAGES.menu },
      { name: "twitter:image", content: OG_IMAGES.menu },
    ],
    links: [{ rel: "canonical", href: siteUrl("/menu") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(menuJsonLd),
      },
    ],
  }),
  loader: () => { prefetchMenu(); },
  component: MenuPage,
});
