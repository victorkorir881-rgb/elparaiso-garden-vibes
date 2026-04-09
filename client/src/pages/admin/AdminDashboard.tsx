import { CalendarCheck, MessageSquare, Images, UtensilsCrossed, PartyPopper, TrendingUp, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

export default function AdminDashboard() {
  const { data: stats, isLoading } = trpc.admin.dashboard.useQuery();
  const { data: activity } = trpc.admin.activityLog.useQuery();
  const { data: recentRes } = trpc.reservations.list.useQuery({});

  const statCards = [
    { label: "Today's Reservations", value: stats?.reservationsToday ?? 0, sub: `${stats?.pendingReservations ?? 0} pending`, icon: CalendarCheck, href: "/admin/reservations", color: "text-blue-400" },
    { label: "Unread Messages", value: stats?.newMessages ?? 0, sub: "contact inquiries", icon: MessageSquare, href: "/admin/messages", color: "text-yellow-400" },
    { label: "Featured Menu Items", value: stats?.featuredMenuItems ?? 0, sub: "on menu", icon: UtensilsCrossed, href: "/admin/menu", color: "text-green-400" },
    { label: "Gallery Images", value: stats?.galleryCount ?? 0, sub: "uploaded images", icon: Images, href: "/admin/gallery", color: "text-purple-400" },
    { label: "Active Events", value: stats?.activeEvents ?? 0, sub: "live events", icon: PartyPopper, href: "/admin/events", color: "text-primary" },
    { label: "Pending Reservations", value: stats?.pendingReservations ?? 0, sub: "need action", icon: TrendingUp, href: "/admin/reservations", color: "text-orange-400" },
  ];

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    confirmed: "bg-green-500/20 text-green-400 border-green-500/30",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
    completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of Elparaiso Garden operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <Link key={card.label} href={card.href}>
            <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className={`text-2xl font-bold ${card.color} mb-1`}>
                {isLoading ? "—" : card.value}
              </div>
              <div className="text-xs font-medium text-foreground">{card.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{card.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Reservations + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Recent Reservations</h2>
            <Link href="/admin/reservations" className="text-primary text-xs hover:underline">View all</Link>
          </div>
          {recentRes && recentRes.length > 0 ? (
            <div className="space-y-3">
              {recentRes.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-medium text-foreground">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.date} · {r.time} · {r.guests} guests</div>
                  </div>
                  <Badge className={`text-xs border ${statusColor[r.status] ?? statusColor.pending}`}>
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No reservations yet.</p>
          )}
        </div>

        {/* Activity Log */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Recent Activity</h2>
          </div>
          {activity && activity.length > 0 ? (
            <div className="space-y-3">
              {activity.slice(0, 8).map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 py-1.5 border-b border-border last:border-0">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-3 h-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">{log.action}</div>
                    <div className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No activity yet.</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Add Menu Item", href: "/admin/menu" },
            { label: "Upload Gallery Photo", href: "/admin/gallery" },
            { label: "Create Event", href: "/admin/events" },
            { label: "View Messages", href: "/admin/messages" },
            { label: "Update Settings", href: "/admin/settings" },
            { label: "Manage SEO", href: "/admin/seo" },
          ].map((action) => (
            <Link key={action.label} href={action.href}>
              <button className="px-4 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all">
                {action.label}
              </button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
