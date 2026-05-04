import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// shared QueryClient — keep data fresh across route changes so navigating
// to a page that fetches data doesn't show a flash of "Loading..." every
// time. Pages still render their own skeletons on first load.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function createRouter() {
  const router = createTanStackRouter({
    routeTree,
    // preload route code on link hover/intent so the page swaps instantly
    defaultPreload: "intent",
    // keep preloaded data warm for 60s so the click after preload is instant
    defaultPreloadStaleTime: 60 * 1000,
    scrollRestoration: true,
  });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
