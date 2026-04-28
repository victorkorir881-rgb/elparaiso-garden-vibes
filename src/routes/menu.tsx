import { createFileRoute } from "@tanstack/react-router";
import MenuPage from "@/pages/public/MenuPage";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu — Elparaiso Garden Kisii" },
      { name: "description", content: "Browse our full menu of nyama choma, grills, drinks and more." },
      { property: "og:title", content: "Menu — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Browse our full menu of nyama choma, grills, drinks and more." },
    ],
  }),
  component: MenuPage,
});
