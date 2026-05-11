import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Customer-facing PWA install entry point.
 *
 * Injects the customer web manifest (scope `/`) and registers the no-op
 * service worker required for installability, then exposes an Install button
 * that fires the browser's native prompt when available. Hidden inside the
 * Lovable editor preview (iframe) where SWs cause stale-cache issues.
 */
export default function CustomerInstallButton() {
  const navigate = useNavigate();
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(true);

    // Skip manifest + SW injection inside an iframe (Lovable editor preview)
    // because SWs in iframes cause stale caches and break live reload. The
    // Install button still renders so users can open the help page.
    const inIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    const isPreviewHost =
      window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovableproject.com");
    if (inIframe || isPreviewHost) return;

    let link: HTMLLinkElement | null = document.querySelector(
      'link[rel="manifest"][data-customer-pwa="1"]'
    );
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/manifest-customer.webmanifest";
      link.dataset.customerPwa = "1";
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
      // No native prompt available (iOS Safari, or prompt not yet fired) —
      // send the user to the help page with step-by-step instructions.
      navigate({ to: "/install" });
      return;
    }
    await installEvt.prompt();
    const { outcome } = await installEvt.userChoice;
    if (outcome === "accepted") toast.success("App installed!");
    setInstallEvt(null);
  };

  if (!supported || installed) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleInstall}
      className="rounded-full"
      title="Install Elparaiso on this device"
    >
      <Download className="w-4 h-4 mr-1.5" />
      Install app
    </Button>
  );
}
