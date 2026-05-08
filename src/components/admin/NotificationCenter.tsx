import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, MessageSquare, CalendarCheck, Package } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface NotificationItem {
  id: string;
  kind: "message" | "reservation" | "order";
  title: string;
  subtitle: string;
  href: string;
  createdAt: string;
}

const MAX_PER_KIND = 5;

function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const sb = supabase as any;
      const [msgsRes, resRes, ordRes] = await Promise.all([
        sb
          .from("contact_messages")
          .select("id, name, subject, created_at, is_read")
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(MAX_PER_KIND),
        sb
          .from("reservations")
          .select("id, name, party_size, date, time, status, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(MAX_PER_KIND),
        sb
          .from("orders")
          .select("id, order_number, customer_name, status, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(MAX_PER_KIND),
      ]);

      if (msgsRes.error) throw msgsRes.error;
      if (resRes.error) throw resRes.error;
      if (ordRes.error) throw ordRes.error;

      const items: NotificationItem[] = [
        ...(msgsRes.data ?? []).map((m: any) => ({
          id: `msg-${m.id}`,
          kind: "message" as const,
          title: m.name ?? "New message",
          subtitle: m.subject ?? "Sent you a message",
          href: "/admin/messages",
          createdAt: m.created_at,
        })),
        ...(resRes.data ?? []).map((r: any) => ({
          id: `res-${r.id}`,
          kind: "reservation" as const,
          title: `${r.name} · ${r.party_size} guests`,
          subtitle: `${r.date} at ${r.time}`,
          href: "/admin/reservations",
          createdAt: r.created_at,
        })),
        ...(ordRes.data ?? []).map((o: any) => ({
          id: `ord-${o.id}`,
          kind: "order" as const,
          title: `Order ${o.order_number}`,
          subtitle: o.customer_name ?? "New order",
          href: "/admin/orders",
          createdAt: o.created_at,
        })),
      ].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

      return {
        items,
        counts: {
          messages: msgsRes.data?.length ?? 0,
          reservations: resRes.data?.length ?? 0,
          orders: ordRes.data?.length ?? 0,
        },
      };
    },
  });
}

const ICONS = {
  message: MessageSquare,
  reservation: CalendarCheck,
  order: Package,
} as const;

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data } = useNotifications();

  // Realtime: refresh on any insert/update across the three tables.
  useEffect(() => {
    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contact_messages" },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations" },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const total = useMemo(() => {
    if (!data) return 0;
    return data.counts.messages + data.counts.reservations + data.counts.orders;
  }, [data]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label={`Notifications${total ? ` (${total} unread)` : ""}`}
        >
          <Bell className="w-4 h-4" />
          {total > 0 && (
            <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1 py-0 h-4 min-w-4 flex items-center justify-center rounded-full">
              {total > 9 ? "9+" : total}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0 bg-card border-border"
        sideOffset={8}
      >
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="font-semibold text-sm text-foreground">
            Notifications
          </span>
          <span className="text-xs text-muted-foreground">
            {total > 0 ? `${total} pending` : "All caught up"}
          </span>
        </div>

        {data && total > 0 ? (
          <ul className="max-h-96 overflow-y-auto divide-y divide-border">
            {data.items.map((item) => {
              const Icon = ICONS[item.kind];
              return (
                <li key={item.id}>
                  <Link
                    to={item.href}
                    onClick={() => setOpen(false)}
                    className="flex gap-3 p-3 hover:bg-accent/60 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.subtitle}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {item.createdAt
                          ? formatDistanceToNow(new Date(item.createdAt), {
                              addSuffix: true,
                            })
                          : ""}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No pending items right now.
          </div>
        )}

        <div className="p-2 border-t border-border grid grid-cols-3 gap-1 text-xs">
          <Link
            to="/admin/messages"
            onClick={() => setOpen(false)}
            className="text-center py-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            Messages
          </Link>
          <Link
            to="/admin/reservations"
            onClick={() => setOpen(false)}
            className="text-center py-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            Reservations
          </Link>
          <Link
            to="/admin/orders"
            onClick={() => setOpen(false)}
            className="text-center py-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            Orders
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
