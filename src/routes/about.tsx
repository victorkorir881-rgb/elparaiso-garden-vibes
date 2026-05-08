import { createFileRoute } from "@tanstack/react-router";
import AboutPage from "@/pages/public/AboutPage";
import { OG_IMAGES } from "@/lib/og-images";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Elparaiso Garden Kisii" },
      { name: "description", content: "Our story, values, team and what makes Elparaiso Garden special." },
      { property: "og:title", content: "About — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Our story, values, team and what makes Elparaiso Garden special." },
      { property: "og:image", content: OG_IMAGES.about },
      { name: "twitter:image", content: OG_IMAGES.about },
    ],
    links: [{ rel: "canonical", href: siteUrl("/about") }],
  }),
  component: AboutPage,
});
