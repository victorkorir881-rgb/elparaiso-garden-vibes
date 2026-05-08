import { createFileRoute } from "@tanstack/react-router";
import TermsPage from "@/pages/public/TermsPage";
import { siteUrl } from "@/lib/site-url";
import { OG_IMAGES } from "@/lib/og-images";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Elparaiso Garden Kisii" },
      { name: "description", content: "Terms governing the use of our website and services." },
      { property: "og:title", content: "Terms of Service — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Terms governing the use of our website and services." },
      { property: "og:image", content: OG_IMAGES.home },
      { name: "twitter:image", content: OG_IMAGES.home },
    ],
    links: [{ rel: "canonical", href: siteUrl("/terms") }],
  }),
  component: TermsPage,
});
