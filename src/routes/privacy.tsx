import { createFileRoute } from "@tanstack/react-router";
import PrivacyPage from "@/pages/public/PrivacyPage";
import { siteUrl } from "@/lib/site-url";
import { OG_IMAGES } from "@/lib/og-images";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Elparaiso Garden Kisii" },
      { name: "description", content: "How we collect, use and protect your information." },
      { property: "og:title", content: "Privacy Policy — Elparaiso Garden Kisii" },
      { property: "og:description", content: "How we collect, use and protect your information." },
      { property: "og:image", content: OG_IMAGES.home },
      { name: "twitter:image", content: OG_IMAGES.home },
    ],
    links: [{ rel: "canonical", href: siteUrl("/privacy") }],
  }),
  component: PrivacyPage,
});
