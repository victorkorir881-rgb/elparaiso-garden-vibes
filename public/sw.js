// minimal service worker — required for PWA installability.
// i intentionally keep this network-first / no-cache so admins always get
// the freshest build; the goal here is install-ability, not offline mode.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // pass through — no caching
});
