import { useEffect, useState } from "react";
import PublicLayout from "@/components/public/PublicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone, Apple, Monitor, Download, CheckCircle2,
  Share, Plus, MoreVertical, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useInstallStatus } from "@/hooks/useInstallStatus";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "desktop" | "unknown";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows|Macintosh|Linux/.test(ua)) return "desktop";
  return "unknown";
}

export default function InstallAppPage() {
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const installed = useInstallStatus();
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [openTab, setOpenTab] = useState<Platform>("ios");

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    setOpenTab(p === "unknown" ? "ios" : p);

    // Inject manifest + register SW so the install prompt can fire here too.
    const inIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    const isPreviewHost =
      window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovableproject.com");

    if (!inIframe && !isPreviewHost) {
      if (!document.querySelector('link[rel="manifest"][data-customer-pwa="1"]')) {
        const link = document.createElement("link");
        link.rel = "manifest";
        link.href = "/manifest-customer.webmanifest";
        link.dataset.customerPwa = "1";
        document.head.appendChild(link);
      }
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstallEvt(null);
      toast.success("App installed!");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvt) {
      toast.info("Follow the steps below for your device.");
      return;
    }
    await installEvt.prompt();
    const { outcome } = await installEvt.userChoice;
    if (outcome === "accepted") { /* installed flips via useInstallStatus */ }
    setInstallEvt(null);
  };

  const tabs: { id: Platform; label: string; icon: any }[] = [
    { id: "ios", label: "iPhone / iPad", icon: Apple },
    { id: "android", label: "Android", icon: Smartphone },
    { id: "desktop", label: "Desktop", icon: Monitor },
  ];

  return (
    <PublicLayout>
      <section className="container py-12 md:py-16 max-w-3xl">
        <div className="text-center mb-10">
          <img src="/logo.png" alt="Elparaiso Garden Kisii logo" className="w-24 h-24 mx-auto mb-4 rounded-full object-cover bg-white border border-primary/20" />
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">Install the app</Badge>
          <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-3">
            Get Elparaiso on your device
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Order food, book a table, and track deliveries faster — right from your home screen.
            No app store needed.
          </p>
        </div>

        {/* Status card */}
        <Card
          className={`p-5 mb-8 border-2 ${
            installed ? "border-green-500/50 bg-green-500/5" : "border-primary/30"
          }`}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {installed ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-foreground">App installed</div>
                    <div className="text-sm text-muted-foreground">
                      You're using the installed Elparaiso app on this device.
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Download className="w-6 h-6 text-primary shrink-0" />
                  <div>
                    <div className="font-semibold text-foreground">Not installed yet</div>
                    <div className="text-sm text-muted-foreground">
                      Detected device: <span className="capitalize text-foreground">{platform}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
            {!installed && installEvt && (
              <Button onClick={handleInstall} size="lg">
                <Download className="w-4 h-4 mr-2" />
                Install now
              </Button>
            )}
          </div>
        </Card>

        {/* Platform tabs */}
        <div className="flex gap-2 mb-4 border-b border-border">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = openTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setOpenTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {openTab === "ios" && (
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Apple className="w-5 h-5 text-primary" /> Install on iPhone or iPad
            </h2>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">1</span>
                <span>Open this site in <strong className="text-foreground">Safari</strong> (Chrome and Firefox on iOS can't install apps).</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">2</span>
                <span>Tap the <Share className="inline w-4 h-4 mx-1 text-foreground" /> <strong className="text-foreground">Share</strong> button at the bottom of the screen.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">3</span>
                <span>Scroll down and tap <Plus className="inline w-4 h-4 mx-1 text-foreground" /> <strong className="text-foreground">Add to Home Screen</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">4</span>
                <span>Tap <strong className="text-foreground">Add</strong> in the top-right. The Elparaiso icon appears on your home screen.</span>
              </li>
            </ol>
          </Card>
        )}

        {openTab === "android" && (
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" /> Install on Android
            </h2>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">1</span>
                <span>Open this site in <strong className="text-foreground">Chrome</strong> (or any Chromium browser).</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">2</span>
                <span>Tap the <MoreVertical className="inline w-4 h-4 mx-1 text-foreground" /> menu in the top-right.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">3</span>
                <span>Tap <strong className="text-foreground">Install app</strong> or <strong className="text-foreground">Add to Home screen</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">4</span>
                <span>Confirm <strong className="text-foreground">Install</strong>. Or use the green button below if your browser supports it:</span>
              </li>
            </ol>
            <Button onClick={handleInstall} disabled={!installEvt && !installed} className="w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" />
              {installed ? "Already installed" : installEvt ? "Install now" : "Install prompt unavailable"}
            </Button>
          </Card>
        )}

        {openTab === "desktop" && (
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary" /> Install on Desktop
            </h2>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">1</span>
                <span>Open this site in <strong className="text-foreground">Chrome</strong>, <strong className="text-foreground">Edge</strong>, or <strong className="text-foreground">Brave</strong>. (Safari on Mac and Firefox don't support PWA install.)</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">2</span>
                <span>Look for the <Download className="inline w-4 h-4 mx-1 text-foreground" /> install icon on the right side of the address bar.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">3</span>
                <span>Click it and confirm <strong className="text-foreground">Install</strong>. Or use the button below:</span>
              </li>
            </ol>
            <Button onClick={handleInstall} disabled={!installEvt && !installed} size="lg">
              <Download className="w-4 h-4 mr-2" />
              {installed ? "Already installed" : installEvt ? "Install now" : "Install prompt unavailable"}
            </Button>
            <p className="text-xs text-muted-foreground">
              If the button is disabled, your browser hasn't fired the install prompt yet. Refresh the page after browsing for a few seconds, or use the address-bar install icon.
            </p>
          </Card>
        )}

        {/* FAQ */}
        <div className="mt-10 space-y-3">
          <h2 className="font-display text-xl font-bold text-foreground mb-2">FAQ</h2>
          <FAQ q="Does this cost anything?" a="No. Installing the Elparaiso app is free — it's the same website packaged as an app." />
          <FAQ q="Will it use a lot of storage?" a="No. The app is only a few hundred kilobytes. It opens fullscreen without the browser bar." />
          <FAQ q="How do I uninstall?" a="On iPhone, long-press the icon and tap 'Remove App'. On Android, long-press and tap 'Uninstall'. On desktop, open the app, click the three-dot menu, and choose 'Uninstall'." />
          <FAQ q="Does it work offline?" a="Basic browsing won't work offline yet — you need an internet connection to place orders or load the menu. Faster startup is the main benefit today." />
        </div>
      </section>
    </PublicLayout>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-0 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-accent/40 transition-colors"
      >
        <span className="font-medium text-foreground text-sm">{q}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 text-sm text-muted-foreground">{a}</div>}
    </Card>
  );
}
