import { createFileRoute } from "@tanstack/react-router";
import AcceptInvite from "@/pages/admin/AcceptInvite";

export const Route = createFileRoute("/admin/accept-invite")({
  head: () => ({
    meta: [
      { title: "Accept invitation — Elparaiso Garden Kisii" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AcceptInvite,
});
