import { createFileRoute } from "@tanstack/react-router";
import InstallAppPage from "@/pages/public/InstallAppPage";

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [
      { title: "Install the Elparaiso App — iPhone, Android & Desktop" },
      { name: "description", content: "Step-by-step instructions to install the Elparaiso Garden app on your iPhone, Android phone, or desktop. Order food and book tables faster." },
      { property: "og:title", content: "Install the Elparaiso App" },
      { property: "og:description", content: "Add Elparaiso Garden to your home screen for faster ordering and reservations." },
    ],
  }),
  component: InstallAppPage,
});
