import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tables whose changes should auto-refresh the matching React Query caches.
 * The keys correspond to row-level invalidations the admin panel cares about.
 *
 * Requires the table to be a member of the `supabase_realtime` publication
 * (see sql/0021, 0022, 0026).
 */
const TABLE_TO_QUERY_KEYS: Record<string, string[][]> = {
  orders: [
    ["orders"],
    ["orderStats"],
    ["adminDashboard"],
    ["reconciliation"],
  ],
  reservation_leads: [["reservations"], ["adminDashboard"]],
  contact_messages: [["contactMessages"], ["unreadMessages"], ["adminDashboard"]],
  reviews: [["reviews"], ["adminDashboard"]],
  payments: [
    ["orderPayments"],
    ["payments"],
    ["manualClaims"],
    ["reconciliation"],
  ],
  menu_items: [["menuItems"], ["adminDashboard"]],
  menu_categories: [["menuCategories"]],
  events: [["events"]],
  gallery_images: [["gallery"]],
};

/**
 * Subscribes to Postgres change events on every admin-relevant table and
 * invalidates the matching React Query keys so list views, dashboard tiles,
 * and counters update immediately — no manual refresh required.
 *
 * Mount once in a high-level component (e.g. AdminLayout). Polling stays as
 * a fallback in hooks that opt into `refetchInterval`.
 */
export function useRealtimeAdminSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const sb = supabase as any;
    const channel = sb.channel("admin-realtime-sync");

    for (const [table, keys] of Object.entries(TABLE_TO_QUERY_KEYS)) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          for (const key of keys) {
            qc.invalidateQueries({ queryKey: key });
          }
        },
      );
    }

    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}
