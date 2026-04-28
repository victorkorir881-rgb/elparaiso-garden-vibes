import { createFileRoute } from "@tanstack/react-router";
import TermsPage from "@/pages/public/TermsPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Elparaiso Garden Kisii" },
      { name: "description", content: "Terms governing the use of our website and services." },
      { property: "og:title", content: "Terms of Service — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Terms governing the use of our website and services." },
    ],
  }),
  component: TermsPage,
});
