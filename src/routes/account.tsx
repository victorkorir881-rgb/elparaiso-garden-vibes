import { createFileRoute } from "@tanstack/react-router";
import CustomerAccountPage from "@/pages/public/CustomerAccountPage";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Account — Elparaiso Garden Kisii" },
      { name: "description", content: "View your order history and track active orders." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: siteUrl("/account") }],
  }),
  component: CustomerAccountPage,
});
