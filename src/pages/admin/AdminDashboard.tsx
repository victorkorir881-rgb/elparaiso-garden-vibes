import {
  CalendarCheck, MessageSquare, ShoppingBag, ArrowUpRight, Clock,
  ReceiptText, Wallet, AlertCircle, Plus, Timer, ChefHat, Truck, CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  useAdminDashboardStats, useReservations, useOrders, useActivityLog,
} from "@/lib/supabase-hooks";
import { Link } from "@tanstack/react-router";

const KES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n || 0);

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminDashboardStats();
  const { data: recentRes } = useReservations({});
  const { data: recentOrders } = useOrders({});
  const { data: activity } = useActivityLog();

  // Orders-led KPIs. Reservations no longer occupy a primary slot.
  const primaryCards = [
    {
      label: "Active Orders",
      value: stats?.activeOrders ?? 0,
      sub: "in kitchen / out for delivery",
      icon: ShoppingBag,
      to: "/admin/orders",
      accent: true,
    },
    {
      label: "Awaiting Confirmation",
      value: stats?.ordersPendingConfirmation ?? 0,
      sub: "new orders to accept",
      icon: AlertCircle,
      to: "/admin/orders",
    },
    {
      label: "Orders Today",
      value: stats?.ordersToday ?? 0,
      sub: "paid orders received",
      icon: ReceiptText,
      to: "/admin/orders",
    },
    {
      label: "Revenue Today",
      value: KES(stats?.revenueToday ?? 0),
      sub: "gross from paid orders",
      icon: Wallet,
      to: "/admin/analytics",
    },
  ];

  const statusBreakdown = stats?.ordersByStatus ?? {};
  const pipeline = [
    { key: "pending", label: "Pending", icon: Timer },
    { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
    { key: "preparing", label: "Preparing", icon: ChefHat },
    { key: "ready", label: "Ready", icon: ShoppingBag },
    { key: "out_for_delivery", label: "Out for delivery", icon: Truck },
  ];

  const orderStatusColor: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    confirmed: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    preparing: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    ready: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    out_for_delivery: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    completed: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
  };

  const resStatusColor: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    confirmed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
    completed: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const activeOrders = (recentOrders ?? []).filter(
    (o: any) => !["completed", "cancelled"].includes(o.status),
  );

  return (
    <div className="space-y-8">
      {/* Hero header */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border/60 p-6 md:p-8"
        style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-elegant)" }}
      >
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--gradient-gold)" }}
        />
        <div className="relative">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">{greeting}</div>
          <h1 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
            Order control{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-gold)" }}>
              center
            </span>
          </h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-xl">
            Track every order from confirmation to delivery. Reservations and messages stay one click away.
          </p>
        </div>
      </div>

      {/* Primary KPIs — all orders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {primaryCards.map((card) => (
          <Link key={card.label} to={card.to} className="group">
            <div
              className={`relative h-full rounded-2xl border p-4 md:p-5 transition-all hover:-translate-y-0.5 ${
                card.accent ? "border-primary/40" : "border-border/60 hover:border-primary/40"
              }`}
              style={{ background: "var(--gradient-surface)" }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.accent ? "" : "bg-accent/40"}`}
                  style={card.accent ? { background: "var(--gradient-gold)" } : undefined}
                >
                  <card.icon className={`w-5 h-5 ${card.accent ? "text-primary-foreground" : "text-primary"}`} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
              <div className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight mb-1 tabular-nums">
                {isLoading ? "—" : card.value}
              </div>
              <div className="text-xs font-medium text-foreground/90 leading-tight">{card.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{card.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Order pipeline strip — at-a-glance count per stage */}
      <div className="rounded-2xl border border-border/60 p-5" style={{ background: "var(--gradient-surface)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-foreground text-sm">Order pipeline</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Live count of orders at each stage</p>
          </div>
          <Link to="/admin/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
            Manage <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {pipeline.map((p) => {
            const count = statusBreakdown[p.key] ?? 0;
            return (
              <Link
                key={p.key}
                to="/admin/orders"
                className="rounded-xl border border-border/40 bg-background/30 p-3 hover:border-primary/40 hover:bg-accent/20 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <p.icon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">{p.label}</span>
                </div>
                <div className="text-2xl font-semibold text-foreground tabular-nums">{count}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Live Orders queue (full width, primary focus) */}
      <div className="rounded-2xl border border-border/60 p-6" style={{ background: "var(--gradient-surface)" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" /> Live Orders
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Orders still moving through the kitchen — confirm, prepare, and dispatch.
            </p>
          </div>
          <Link to="/admin/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all orders <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {activeOrders.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No active orders right now. New ones will appear here automatically.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                  <th className="px-2 py-2 font-medium">Order</th>
                  <th className="px-2 py-2 font-medium">Customer</th>
                  <th className="px-2 py-2 font-medium hidden sm:table-cell">Type</th>
                  <th className="px-2 py-2 font-medium">Total</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium hidden md:table-cell">Placed</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.slice(0, 12).map((o: any) => (
                  <tr key={o.id} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                    <td className="px-2 py-3">
                      <Link to="/admin/orders" className="font-medium text-foreground hover:text-primary">
                        #{o.order_number}
                      </Link>
                    </td>
                    <td className="px-2 py-3">
                      <div className="text-foreground truncate max-w-[160px]">{o.customer_name}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">{o.customer_phone}</div>
                    </td>
                    <td className="px-2 py-3 hidden sm:table-cell capitalize text-muted-foreground">
                      {String(o.order_type).replace("_", " ")}
                    </td>
                    <td className="px-2 py-3 font-medium tabular-nums">{KES(Number(o.total_amount))}</td>
                    <td className="px-2 py-3">
                      <Badge className={`text-[10px] uppercase tracking-wider border ${orderStatusColor[o.status] ?? orderStatusColor.pending}`}>
                        {String(o.status).replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-2 py-3 hidden md:table-cell text-[11px] text-muted-foreground tabular-nums">
                      {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity (primary) + compact reservations + messages (secondary) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-border/60 p-6" style={{ background: "var(--gradient-surface)" }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-foreground">Recent Activity</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Audit log across the admin team</p>
            </div>
            <Link to="/admin/audit-log" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {activity && activity.length > 0 ? (
            <div className="space-y-1">
              {activity.slice(0, 8).map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-accent/40 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">{log.action}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">No activity yet.</div>
          )}
        </div>

        {/* Compact side rail: reservations + messages */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/60 p-5" style={{ background: "var(--gradient-surface)" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-primary" /> Reservations
              </h2>
              <Link to="/admin/reservations" className="text-[11px] text-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="flex items-baseline gap-3 mb-3">
              <div className="text-2xl font-semibold text-foreground tabular-nums">
                {stats?.reservationsToday ?? 0}
              </div>
              <div className="text-[11px] text-muted-foreground">
                today · {stats?.pendingReservations ?? 0} pending
              </div>
            </div>
            {recentRes && recentRes.length > 0 ? (
              <div className="space-y-1">
                {recentRes.slice(0, 3).map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-t border-border/40">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground truncate">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {r.date} · {r.time} · {r.party_size}
                      </div>
                    </div>
                    <Badge className={`text-[9px] uppercase tracking-wider border ${resStatusColor[r.status] ?? resStatusColor.pending}`}>
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-muted-foreground border-t border-border/40">
                No reservations.
              </div>
            )}
          </div>

          <Link to="/admin/messages" className="block group">
            <div
              className="rounded-2xl border border-border/60 p-5 hover:border-primary/40 transition-all hover:-translate-y-0.5"
              style={{ background: "var(--gradient-surface)" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent/40 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
              <div className="text-2xl font-semibold text-foreground tabular-nums">
                {isLoading ? "—" : (stats?.newMessages ?? 0)}
              </div>
              <div className="text-xs font-medium text-foreground/90 mt-1">Unread Messages</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">contact inquiries</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl border border-border/60 p-6" style={{ background: "var(--gradient-surface)" }}>
        <div className="mb-4">
          <h2 className="font-semibold text-foreground">Quick Actions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Jump into the most common tasks</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { label: "All Orders", to: "/admin/orders" },
            { label: "Menu", to: "/admin/menu" },
            { label: "Analytics", to: "/admin/analytics" },
            { label: "Messages", to: "/admin/messages" },
            { label: "Reservations", to: "/admin/reservations" },
            { label: "Settings", to: "/admin/settings" },
          ].map((action) => (
            <Link key={action.label} to={action.to}>
              <button className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-border/60 bg-background/40 text-sm font-medium text-foreground hover:border-primary/50 hover:bg-accent/30 transition-all">
                <Plus className="w-3.5 h-3.5 text-primary" />
                {action.label}
              </button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
