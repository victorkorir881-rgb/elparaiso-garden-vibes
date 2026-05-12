import { useEffect, useState } from "react";

/**
 * Reliably reports whether the app is currently running as an installed PWA.
 *
 * Listens for:
 *  - display-mode media query changes (standalone / fullscreen / minimal-ui)
 *  - iOS Safari `navigator.standalone`
 *  - Android TWA referrer
 *  - `appinstalled` event (sets installed immediately)
 *  - `visibilitychange` (re-checks when user switches back to the app)
 *
 * Returns a boolean that flips live as the install state changes — e.g.
 * launching the installed app from the home screen will report `true`
 * without a refresh.
 */
export function useInstallStatus(): boolean {
  const [installed, setInstalled] = useState<boolean>(() => detect());

  useEffect(() => {
    const update = () => setInstalled(detect());
    update();

    const queries = [
      "(display-mode: standalone)",
      "(display-mode: fullscreen)",
      "(display-mode: minimal-ui)",
      "(display-mode: window-controls-overlay)",
    ]
      .map((q) => {
        try { return window.matchMedia(q); } catch { return null; }
      })
      .filter((m): m is MediaQueryList => !!m);

    const onChange = () => update();
    queries.forEach((m) => {
      // Safari <14 only supports addListener
      if (m.addEventListener) m.addEventListener("change", onChange);
      else m.addListener(onChange);
    });

    const onInstalled = () => setInstalled(true);
    const onVisibility = () => { if (!document.hidden) update(); };
    const onFocus = () => update();

    window.addEventListener("appinstalled", onInstalled);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      queries.forEach((m) => {
        if (m.removeEventListener) m.removeEventListener("change", onChange);
        else m.removeListener(onChange);
      });
      window.removeEventListener("appinstalled", onInstalled);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return installed;
}

function detect(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
    if (window.matchMedia?.("(display-mode: fullscreen)").matches) return true;
    if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return true;
    if (window.matchMedia?.("(display-mode: window-controls-overlay)").matches) return true;
  } catch { /* noop */ }
  // iOS Safari
  if ((navigator as any).standalone === true) return true;
  // Android Trusted Web Activity
  if (typeof document !== "undefined" && document.referrer.startsWith("android-app://")) return true;
  return false;
}
