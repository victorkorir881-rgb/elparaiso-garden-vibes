import { createFileRoute } from "@tanstack/react-router";
import MenuPage from "@/pages/public/MenuPage";

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
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(menuJsonLd),
      },
    ],
  }),
  component: MenuPage,
});
