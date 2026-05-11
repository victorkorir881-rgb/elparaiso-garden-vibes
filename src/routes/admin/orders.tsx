import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import AdminOrders from "@/pages/admin/AdminOrders";

export const ordersSearchSchema = z.object({
  status: fallback(z.string(), "all").default("all"),
  type: fallback(z.string(), "all").default("all"),
  q: fallback(z.string(), "").default(""),
  sort: fallback(
    z.enum(["newest", "oldest", "total_desc", "total_asc", "status"]),
    "newest",
  ).default("newest"),
  page: fallback(z.number().int().min(1), 1).default(1),
});

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "Admin · Orders — Elparaiso Garden Kisii" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: zodValidator(ordersSearchSchema),
  component: AdminOrders,
});
