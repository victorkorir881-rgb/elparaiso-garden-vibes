import { createFileRoute } from "@tanstack/react-router";
import ContactPage from "@/pages/public/ContactPage";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Elparaiso Garden Kisii" },
      { name: "description", content: "Reach us by phone, WhatsApp, email or visit us in Kisii." },
      { property: "og:title", content: "Contact — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Reach us by phone, WhatsApp, email or visit us in Kisii." },
    ],
  }),
  component: ContactPage,
});
