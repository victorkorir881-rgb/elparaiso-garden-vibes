import { createFileRoute } from "@tanstack/react-router";
import GalleryPage from "@/pages/public/GalleryPage";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — Elparaiso Garden Kisii" },
      { name: "description", content: "Photos of our food, venue, events and atmosphere." },
      { property: "og:title", content: "Gallery — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Photos of our food, venue, events and atmosphere." },
    ],
  }),
  component: GalleryPage,
});
