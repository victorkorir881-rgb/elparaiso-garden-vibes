import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, MessageSquare, CalendarCheck, Package, Star, Check, X, CheckCheck } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

const DISMISS_KEY = "admin.notifications.dismissed.v1";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...set]));
  } catch {}
}

interface NotificationItem {
  id: string;
  kind: "message" | "reservation" | "order" | "review";
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
      const [msgsRes, resRes, ordRes, revRes] = await Promise.all([
        sb
          .from("contact_messages")
          .select("id, name, inquiry_type, created_at, is_read")
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(MAX_PER_KIND),
        sb
          .from("reservation_leads")
          .select("id, name, party_size, date, time, status, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(MAX_PER_KIND),
        sb
          .from("orders")
          .select("id, order_number, customer_name, status, created_at")
          .eq("status", "pending")
          .neq("payment_status", "pending")
          .order("created_at", { ascending: false })
          .limit(MAX_PER_KIND),
        sb
          .from("reviews")
          .select("id, author_name, rating, comment, is_approved, created_at")
          .eq("is_approved", false)
          .order("created_at", { ascending: false })
          .limit(MAX_PER_KIND),
      ]);

      if (msgsRes.error) throw msgsRes.error;
      if (resRes.error) throw resRes.error;
      if (ordRes.error) throw ordRes.error;
      if (revRes.error) throw revRes.error;

      const items: NotificationItem[] = [
        ...(msgsRes.data ?? []).map((m: any) => ({
          id: `msg-${m.id}`,
          kind: "message" as const,
          title: m.name ?? "New message",
          subtitle: m.inquiry_type ?? "Sent you a message",
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
        ...(revRes.data ?? []).map((rv: any) => ({
          id: `rev-${rv.id}`,
          kind: "review" as const,
          title: `${rv.author_name} · ${"★".repeat(rv.rating ?? 0)}`,
          subtitle: rv.comment ?? "New review awaiting approval",
          href: "/admin/testimonials",
          createdAt: rv.created_at,
        })),
      ].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

      return {
        items,
        counts: {
          messages: msgsRes.data?.length ?? 0,
          reservations: resRes.data?.length ?? 0,
          orders: ordRes.data?.length ?? 0,
          reviews: revRes.data?.length ?? 0,
        },
      };
    },
  });
}

const ICONS = {
  message: MessageSquare,
  reservation: CalendarCheck,
  order: Package,
  review: Star,
} as const;

type RealtimeKind = "message" | "reservation" | "order" | "review";

function describeRealtimeRow(kind: RealtimeKind, row: any): string {
  switch (kind) {
    case "message":
      return `New message from ${row?.name ?? "a visitor"}`;
    case "reservation":
      return `New reservation: ${row?.name ?? "guest"} · ${row?.date ?? ""} ${row?.time ?? ""}`.trim();
    case "order":
      return `New order ${row?.order_number ?? ""} from ${row?.customer_name ?? "a customer"}`.trim();
    case "review":
      return `New review by ${row?.author_name ?? "a guest"} (${row?.rating ?? 0}★)`;
  }
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data } = useNotifications();
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const dismissAll = useCallback((ids: string[]) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      saveDismissed(next);
      return next;
    });
  }, []);

  // Skip toasts on the very first realtime event burst that fires when the
  // channel subscribes against an already-populated table.
  const readyRef = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => {
      readyRef.current = true;
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  // Realtime: refresh + toast on every INSERT into the four public tables.
  useEffect(() => {
    const handle = (kind: RealtimeKind, href: string) => (payload: any) => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["dashboardStats"] });
      qc.invalidateQueries({ queryKey: [kind === "reservation" ? "reservations" : `${kind}s`] });
      if (!readyRef.current) return;
      toast.message(describeRealtimeRow(kind, payload?.new), {
        action: { label: "View", onClick: () => (window.location.href = href) },
      });
    };

    const channel = supabase
      .channel("admin-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contact_messages" }, handle("message", "/admin/messages"))
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_messages" }, () => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reservation_leads" }, handle("reservation", "/admin/reservations"))
      .on("postgres_changes", { event: "*", schema: "public", table: "reservation_leads" }, () => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, handle("order", "/admin/orders"))
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reviews" }, handle("review", "/admin/testimonials"))
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, () => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  // Mark a contact message as read in the DB (best-effort) AND dismiss locally.
  const markMessageRead = useCallback(
    async (messageRowId: string, notifId: string) => {
      dismiss(notifId);
      const { error } = await supabase
        .from("contact_messages")
        .update({ is_read: true })
        .eq("id", messageRowId);
      if (error) {
        // Roll back local dismiss so the user sees the failure.
        setDismissed((prev) => {
          const next = new Set(prev);
          next.delete(notifId);
          saveDismissed(next);
          return next;
        });
        toast.error(error.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    [dismiss, qc],
  );

  const visibleItems = useMemo(
    () => (data?.items ?? []).filter((i) => !dismissed.has(i.id)),
    [data, dismissed],
  );
  const total = visibleItems.length;

  // Garbage-collect dismissed IDs that no longer appear in the live set so
  // the localStorage entry doesn't grow forever.
  useEffect(() => {
    if (!data) return;
    const live = new Set(data.items.map((i) => i.id));
    let changed = false;
    const next = new Set<string>();
    dismissed.forEach((id) => {
      if (live.has(id)) next.add(id);
      else changed = true;
    });
    if (changed) {
      setDismissed(next);
      saveDismissed(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        className="w-96 p-0 bg-card border-border text-foreground"
        sideOffset={8}
      >
        <div className="p-3 border-b border-border flex items-center justify-between gap-2">
          <span className="font-semibold text-sm text-foreground">Notifications</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {total > 0 ? `${total} unread` : "All caught up"}
            </span>
            {total > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => dismissAll(visibleItems.map((i) => i.id))}
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {total > 0 ? (
          <ul className="max-h-96 overflow-y-auto divide-y divide-border">
            {visibleItems.map((item) => {
              const Icon = ICONS[item.kind];
              const rowId = item.id.replace(/^(msg|res|ord|rev)-/, "");
              return (
                <li key={item.id} className="group relative hover:bg-accent/60 transition-colors">
                  <Link
                    to={item.href}
                    onClick={() => {
                      if (item.kind === "message") {
                        void markMessageRead(rowId, item.id);
                      } else {
                        dismiss(item.id);
                      }
                      setOpen(false);
                    }}
                    className="flex gap-3 p-3 pr-20"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{item.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                      <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : ""}
                      </div>
                    </div>
                  </Link>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (item.kind === "message") void markMessageRead(rowId, item.id);
                        else dismiss(item.id);
                      }}
                      className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary"
                      aria-label="Mark as read"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dismiss(item.id);
                      }}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      aria-label="Dismiss"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No pending items right now.
          </div>
        )}

        <div className="p-2 border-t border-border grid grid-cols-4 gap-1 text-xs">
          <Link to="/admin/messages" onClick={() => setOpen(false)} className="text-center py-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">Messages</Link>
          <Link to="/admin/reservations" onClick={() => setOpen(false)} className="text-center py-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">Tables</Link>
          <Link to="/admin/orders" onClick={() => setOpen(false)} className="text-center py-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">Orders</Link>
          <Link to="/admin/testimonials" onClick={() => setOpen(false)} className="text-center py-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">Reviews</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
