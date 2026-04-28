import { createFileRoute } from "@tanstack/react-router";
import AdminTestimonials from "@/pages/admin/AdminTestimonials";

export const Route = createFileRoute("/admin/testimonials")({
  head: () => ({ meta: [{ title: "Admin · Testimonials — Elparaiso Garden Kisii" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminTestimonials,
});
