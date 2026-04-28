import { createFileRoute } from "@tanstack/react-router";
import PrivacyPage from "@/pages/public/PrivacyPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Elparaiso Garden Kisii" },
      { name: "description", content: "How we collect, use and protect your information." },
      { property: "og:title", content: "Privacy Policy — Elparaiso Garden Kisii" },
      { property: "og:description", content: "How we collect, use and protect your information." },
    ],
  }),
  component: PrivacyPage,
});
