import { createFileRoute } from "@tanstack/react-router";
import ContactPage from "@/pages/public/ContactPage";
import { OG_IMAGES } from "@/lib/og-images";
import { siteUrl } from "@/lib/site-url";
import { prefetchSettings } from "@/lib/route-prefetch";

const contactJsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Elparaiso Garden Kisii",
  "url": "https://elparaisogardens.vercel.app/contact",
  "telephone": "+254700000000",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Kisii",
    "addressCountry": "KE",
  },
  "openingHours": "Mo-Su 00:00-23:59",
};

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Elparaiso Garden Kisii" },
      { name: "description", content: "Reach us by phone, WhatsApp, email or visit us in Kisii." },
      { property: "og:title", content: "Contact — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Reach us by phone, WhatsApp, email or visit us in Kisii." },
      { property: "og:image", content: OG_IMAGES.contact },
      { name: "twitter:image", content: OG_IMAGES.contact },
    ],
    links: [{ rel: "canonical", href: siteUrl("/contact") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(contactJsonLd),
      },
    ],
  }),
  loader: () => { prefetchSettings(); },
  component: ContactPage,
});
