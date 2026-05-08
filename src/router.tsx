import { QueryCache, MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { logger } from "./lib/logger";

// shared QueryClient — keep data fresh across route changes so navigating
// to a page that fetches data doesn't show a flash of "Loading..." every
// time. Pages still render their own skeletons on first load.
export const queryClient = new QueryClient({
  // Phase 9.1 — surface every TanStack Query failure into structured logs
  // (and Sentry, via logger). Per-call onError handlers still fire.
  queryCache: new QueryCache({
    onError: (error, query) => {
      logger.error("query failed", error, {
        source: "react-query",
        query_key: JSON.stringify(query.queryKey),
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      logger.error("mutation failed", error, {
        source: "react-query",
        mutation_key: mutation.options.mutationKey ? JSON.stringify(mutation.options.mutationKey) : undefined,
      });
    },
  }),
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
    // always start a new page scrolled to top — no flash of scrolled-down content
    scrollRestoration: true,
    scrollRestorationBehavior: "instant",
    getScrollRestorationKey: (location) => location.pathname,
  });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
