import { createFileRoute } from "@tanstack/react-router";
import ResetPassword from "@/pages/ResetPassword";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Elparaiso Garden Kisii" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResetPassword,
});
