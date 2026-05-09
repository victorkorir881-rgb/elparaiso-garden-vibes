import { CalendarCheck, MessageSquare, Images, UtensilsCrossed, PartyPopper, TrendingUp, Clock, ArrowUpRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAdminDashboardStats, useReservations, useActivityLog } from "@/lib/supabase-hooks";
import { Link } from "@tanstack/react-router";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminDashboardStats();
  const { data: activity } = useActivityLog();
  const { data: recentRes } = useReservations({});

  const statCards = [
    { label: "Today's Reservations", value: stats?.reservationsToday ?? 0, sub: `${stats?.pendingReservations ?? 0} pending`, icon: CalendarCheck, to: "/admin/reservations", accent: true },
    { label: "Unread Messages", value: stats?.newMessages ?? 0, sub: "contact inquiries", icon: MessageSquare, to: "/admin/messages" },
    { label: "Active Events", value: stats?.activeEvents ?? 0, sub: "live now", icon: PartyPopper, to: "/admin/events" },
    { label: "Featured Menu", value: stats?.featuredMenuItems ?? 0, sub: "items live", icon: UtensilsCrossed, to: "/admin/menu" },
    { label: "Gallery", value: stats?.galleryCount ?? 0, sub: "uploaded photos", icon: Images, to: "/admin/gallery" },
    { label: "Pending Actions", value: stats?.pendingReservations ?? 0, sub: "need review", icon: TrendingUp, to: "/admin/reservations" },
  ];

  const statusColor: Record<string, string> = {
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

  return (
    <div className="space-y-8">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 p-6 md:p-8" style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-elegant)" }}>
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--gradient-gold)" }}
        />
        <div className="relative">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">{greeting}</div>
          <h1 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
            Welcome back to{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-gold)" }}>
              Elparaiso
            </span>
          </h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-xl">
            Here's a snapshot of what's happening today. Pending items first, then everything else.
          </p>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {statCards.map((card) => (
          <Link key={card.label} to={card.to} className="group">
            <div
              className={`relative h-full rounded-2xl border p-4 md:p-5 transition-all hover:-translate-y-0.5 ${
                card.accent ? "border-primary/30" : "border-border/60 hover:border-primary/40"
              }`}
              style={{ background: "var(--gradient-surface)" }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    card.accent ? "" : "bg-accent/40"
                  }`}
                  style={card.accent ? { background: "var(--gradient-gold)" } : undefined}
                >
                  <card.icon className={`w-4 h-4 ${card.accent ? "text-primary-foreground" : "text-primary"}`} />
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

      {/* Two-column lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border/60 p-6" style={{ background: "var(--gradient-surface)" }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-foreground">Recent Reservations</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Latest bookings across the calendar</p>
            </div>
            <Link to="/admin/reservations" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {recentRes && recentRes.length > 0 ? (
            <div className="space-y-1">
              {recentRes.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.date} · {r.time} · {r.party_size} guests</div>
                  </div>
                  <Badge className={`text-[10px] uppercase tracking-wider border ${statusColor[r.status] ?? statusColor.pending}`}>
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">No reservations yet.</div>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 p-6" style={{ background: "var(--gradient-surface)" }}>
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
              {activity.slice(0, 6).map((log: any) => (
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
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl border border-border/60 p-6" style={{ background: "var(--gradient-surface)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-foreground">Quick Actions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Jump into the most common tasks</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { label: "Add Menu Item", to: "/admin/menu" },
            { label: "Upload Photo", to: "/admin/gallery" },
            { label: "Create Event", to: "/admin/events" },
            { label: "Messages", to: "/admin/messages" },
            { label: "Settings", to: "/admin/settings" },
            { label: "Manage SEO", to: "/admin/seo" },
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
