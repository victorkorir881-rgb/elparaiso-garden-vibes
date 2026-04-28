import { createFileRoute } from "@tanstack/react-router";
import EventsPage from "@/pages/public/EventsPage";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events — Elparaiso Garden Kisii" },
      { name: "description", content: "Upcoming events, live music, themed nights and special offers." },
      { property: "og:title", content: "Events — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Upcoming events, live music, themed nights and special offers." },
    ],
  }),
  component: EventsPage,
});
