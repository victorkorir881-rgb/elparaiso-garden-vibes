import { createFileRoute } from "@tanstack/react-router";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Admin · Analytics — Elparaiso Garden Kisii" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminAnalytics,
});
