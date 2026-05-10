import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Admin-only PWA install entry point.
 *
 * The site's web manifest and service worker are intentionally NOT linked from
 * the public index.html so that customers see no trace of the installable app.
 * This component injects the manifest link, registers the service worker, and
 * exposes an "Install" button — only after an admin user has authenticated and
 * landed inside AdminLayout.
 */
export default function AdminInstallButton() {
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  // Inject manifest + register service worker (admin scope only).
  useEffect(() => {
    let link: HTMLLinkElement | null = document.querySelector(
      'link[rel="manifest"][data-admin-pwa="1"]'
    );
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/manifest.webmanifest";
      link.dataset.adminPwa = "1";
      document.head.appendChild(link);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Detect already-installed standalone display
    if (window.matchMedia?.("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvt) {
      toast.info("Use your browser menu → 'Install App' / 'Add to Home Screen'.");
      return;
    }
    await installEvt.prompt();
    const { outcome } = await installEvt.userChoice;
    if (outcome === "accepted") toast.success("Admin app installed!");
    setInstallEvt(null);
  };

  if (installed) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleInstall}
      className="hidden sm:inline-flex"
      title="Install the admin app on this device"
    >
      <Download className="w-4 h-4 mr-2" />
      Install app
    </Button>
  );
}
