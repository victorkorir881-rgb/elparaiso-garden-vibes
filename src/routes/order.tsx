import { createFileRoute } from "@tanstack/react-router";
import OrderPage from "@/pages/public/OrderPage";

export const Route = createFileRoute("/order")({
  head: () => ({
    meta: [
      { title: "Order Online — Elparaiso Garden Kisii" },
      { name: "description", content: "Order food and drinks online for delivery or pickup." },
      { property: "og:title", content: "Order Online — Elparaiso Garden Kisii" },
      { property: "og:description", content: "Order food and drinks online for delivery or pickup." },
    ],
  }),
  component: OrderPage,
});
