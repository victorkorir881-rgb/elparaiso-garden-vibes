import { createFileRoute } from "@tanstack/react-router";
import AboutPage from "@/pages/public/AboutPage";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Elparaiso Garden Kisii" },
      { name: "description", content: "Our story, values, team and what makes Elparaiso Garden special." },
      { property: "og:title", content: "About — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Our story, values, team and what makes Elparaiso Garden special." },
    ],
  }),
  component: AboutPage,
});
