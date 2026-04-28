// Deprecated. Kept only to satisfy stale imports during the TanStack migration.
// New code MUST use Supabase hooks (src/lib/supabase-hooks.ts) or
// createServerFn-based RPCs. Do not add new usages.
export const trpc = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "tRPC has been removed. Use Supabase hooks or createServerFn instead.",
      );
    },
  },
) as never;
