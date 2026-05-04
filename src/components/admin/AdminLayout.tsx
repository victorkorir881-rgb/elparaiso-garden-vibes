import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, UtensilsCrossed, CalendarCheck, PartyPopper,
  Images, MessageSquare, Settings, Search, Users, Menu, X,
  LogOut, ChevronRight, Star, Bell, Package, Sliders, ScrollText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useUnreadMessageCount } from "@/lib/supabase-hooks";
import { toast } from "sonner";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/menu", label: "Menu Manager", icon: UtensilsCrossed },
  { to: "/admin/orders", label: "Orders", icon: Package },
  { to: "/admin/reservations", label: "Reservations", icon: CalendarCheck },
  { to: "/admin/events", label: "Events & Offers", icon: PartyPopper },
  { to: "/admin/gallery", label: "Gallery", icon: Images },
  { to: "/admin/testimonials", label: "Testimonials", icon: Star },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare },
  { to: "/admin/settings", label: "Site Settings", icon: Settings },
  { to: "/admin/business-rules", label: "Business Rules", icon: Sliders },
  { to: "/admin/seo", label: "SEO", icon: Search },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading, isAuthenticated, signOut } = useAuth();

  const { data: unreadCount } = useUnreadMessageCount();

  // redirect to login when not authenticated — must run in effect, never during render
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: "/admin/login" });
    }
  }, [loading, isAuthenticated, navigate]);

  // Auth guard — show a lightweight skeleton (not a blank screen) while
  // the session is being resolved so the UI feels instant.
  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex">
        <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card shrink-0 animate-pulse">
          <div className="h-16 border-b border-border" />
          <div className="p-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-muted/40" />
            ))}
          </div>
        </aside>
        <div className="flex-1 flex flex-col">
          <div className="h-14 border-b border-border bg-card" />
          <div className="p-6 space-y-4 animate-pulse">
            <div className="h-8 w-48 bg-muted/40 rounded" />
            <div className="h-32 bg-muted/30 rounded-xl" />
            <div className="h-64 bg-muted/20 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!["super_admin", "admin", "manager", "staff"].includes(user?.role ?? "")) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="text-foreground font-semibold text-lg">Access Denied</div>
        <p className="text-muted-foreground text-sm">You don't have permission to access the admin panel.</p>
        <Link to="/"><Button variant="outline" className="border-border text-foreground">Go to Website</Button></Link>
      </div>
    );
  }

  const isActive = (href: string, exact = false) =>
    exact ? location === href : location.startsWith(href);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/admin/login" });
    toast.success("Logged out");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">E</div>
          <div>
            <div className="font-semibold text-foreground text-sm leading-tight">Elparaiso Garden</div>
            <div className="text-xs text-muted-foreground">Admin Panel</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.to, item.exact);
          const showBadge = item.to === "/admin/messages" && unreadCount && unreadCount > 0;
          return (
            <Link
              key={item.to} to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <Badge className="bg-red-500 text-white text-xs px-1.5 py-0 h-4 min-w-4 flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
              {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-semibold">
            {(user?.name ?? "A").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{user?.name ?? "Admin"}</div>
            <div className="text-xs text-muted-foreground capitalize">{user?.role}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/" className="flex-1">
            <Button variant="outline" size="sm" className="w-full border-border text-foreground hover:bg-accent text-xs">
              View Site
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card shrink-0">
        {sidebarContent}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="font-semibold text-foreground">Admin Panel</span>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
          <Button variant="ghost" size="icon" className="lg:hidden text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <Link to="/admin/messages">
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                <Bell className="w-4 h-4" />
                {unreadCount && unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </Button>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
