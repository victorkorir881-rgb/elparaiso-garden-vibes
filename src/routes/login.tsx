import { createFileRoute } from "@tanstack/react-router";
import CustomerLoginPage from "@/pages/public/CustomerLoginPage";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Elparaiso Garden Kisii" },
      { name: "description", content: "Sign in to your Elparaiso Garden account to track orders and view your history." },
    ],
    links: [{ rel: "canonical", href: siteUrl("/login") }],
  }),
  component: CustomerLoginPage,
});
