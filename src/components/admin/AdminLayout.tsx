import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import {
  LayoutDashboard, UtensilsCrossed, CalendarCheck, PartyPopper,
  Images, MessageSquare, Settings, Search, Users, Menu, X,
  LogOut, Star, Package, Sliders, ScrollText, BarChart3,
  ExternalLink, ChevronDown, UserCog, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useUnreadMessageCount } from "@/lib/supabase-hooks";
import { useRealtimeAdminSync } from "@/lib/use-realtime-admin-sync";
import { toast } from "sonner";
import NotificationCenter from "./NotificationCenter";
import AdminInstallButton from "./AdminInstallButton";
import { BrandLogo } from "@/components/BrandLogo";
import { canSeeNavItem, canAccessAdminPath } from "@/lib/permissions";

const navSections = [
  {
    label: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/admin/orders", label: "Orders", icon: Package },
      { to: "/admin/reservations", label: "Reservations", icon: CalendarCheck },
      { to: "/admin/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    label: "Content",
    items: [
      { to: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
      { to: "/admin/pricing", label: "Pricing", icon: Tag },
      { to: "/admin/events", label: "Events & Offers", icon: PartyPopper },
      { to: "/admin/gallery", label: "Gallery", icon: Images },
      { to: "/admin/testimonials", label: "Testimonials", icon: Star },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/settings", label: "Site Settings", icon: Settings },
      { to: "/admin/business-rules", label: "Business Rules", icon: Sliders },
      { to: "/admin/seo", label: "SEO", icon: Search },
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
    ],
  },
];

const allItems = navSections.flatMap((s) => s.items);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, loading, isAuthenticated, signOut, refresh } = useAuth();

  const { data: unreadCount } = useUnreadMessageCount();
  useRealtimeAdminSync();

  // Filter nav by role — RLS is the backstop, this just hides what the
  // user can't access from the sidebar.
  const visibleSections = useMemo(() => {
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => canSeeNavItem(user?.role, item.to)),
      }))
      .filter((section) => section.items.length > 0);
  }, [user?.role]);
  const visibleItems = useMemo(
    () => visibleSections.flatMap((s) => s.items),
    [visibleSections],
  );

  // Eagerly preload every admin route chunk + loader data the moment the
  // shell mounts so tab switches are instant (no chunk fetch, no skeleton).
  useEffect(() => {
    if (!isAuthenticated) return;
    for (const item of visibleItems) {
      void router.preloadRoute({ to: item.to });
    }
  }, [isAuthenticated, router, visibleItems]);

  // Auto-close mobile sidebar whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Lock body scroll while the mobile sidebar is open and close it on Escape.
  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [sidebarOpen]);

  // Auth context skips admin role/profile lookups on the customer site to keep
  // those requests off the customer's network panel. Now that we're inside
  // the admin shell, refresh once to load the real role + profile.
  useEffect(() => {
    if (isAuthenticated && (!user?.role || user.role === "user")) {
      void refresh();
    }
  }, [isAuthenticated, user?.role, refresh]);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate({ to: "/admin/login" });
  }, [loading, isAuthenticated, navigate]);

  const isActive = (href: string, exact = false) =>
    exact ? location === href : location === href || location.startsWith(href + "/");

  const currentItem = useMemo(
    () => [...visibleItems].sort((a, b) => b.to.length - a.to.length).find((i) => isActive(i.to, i.exact)),
    [location, visibleItems]
  );

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex">
        <aside className="hidden lg:flex w-64 flex-col border-r border-border/60 shrink-0 animate-pulse" style={{ background: "var(--gradient-surface)" }}>
          <div className="h-16 border-b border-border/60" />
          <div className="p-4 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-muted/30" />
            ))}
          </div>
        </aside>
        <div className="flex-1 flex flex-col">
          <div className="h-16 border-b border-border/60 bg-card" />
          <div className="p-8 space-y-4 animate-pulse">
            <div className="h-8 w-56 bg-muted/30 rounded" />
            <div className="h-32 bg-muted/20 rounded-xl" />
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
        <Link to="/"><Button variant="outline">Go to Website</Button></Link>
      </div>
    );
  }

  // Per-route role check (RLS is the backstop; this hides the UI surface).
  if (!canAccessAdminPath(user?.role, location)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-foreground font-semibold text-lg">Access Denied</div>
        <p className="text-muted-foreground text-sm max-w-sm">
          Your role (<span className="capitalize">{user?.role?.replace("_", " ")}</span>) doesn't have access to this section. Contact a super admin if you need permission.
        </p>
        <Link to="/admin"><Button variant="outline">Back to Dashboard</Button></Link>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/admin/login" });
    toast.success("Logged out");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-5 h-16 flex items-center border-b border-border/60 shrink-0">
        <Link to="/" className="flex items-center gap-3 group">
          <BrandLogo
            eager
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-contain bg-white p-0.5 sm:p-1 shrink-0 border border-primary/20 text-xs sm:text-sm"
            style={{ boxShadow: "var(--shadow-gold)" }}
          />
          <div className="min-w-0">
            <div className="font-semibold text-foreground text-sm leading-tight tracking-tight">Elparaiso Garden</div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Admin</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {visibleSections.map((section, idx) => (
          <div key={section.label} className={idx > 0 ? "mt-5" : ""}>
            <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.to, item.exact);
                const showBadge = item.to === "/admin/messages" && unreadCount && unreadCount > 0;
                return (
                  <Link
                    key={item.to} to={item.to}
                    preload="intent"
                    onClick={() => setSidebarOpen(false)}
                    className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? "text-foreground bg-accent/60"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                    }`}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full"
                        style={{ background: "var(--gradient-gold)" }}
                      />
                    )}
                    <item.icon className={`w-4 h-4 shrink-0 ${active ? "text-primary" : ""}`} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {showBadge && (
                      <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center border-0">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-border/60 relative">
        <button
          onClick={() => setUserMenuOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent/40 transition-colors"
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0"
            style={{ background: "var(--gradient-gold)" }}
          >
            {(user?.name ?? "A").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-medium text-foreground truncate">{user?.name ?? "Admin"}</div>
            <div className="text-[11px] text-muted-foreground capitalize truncate">{user?.role?.replace("_", " ")}</div>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
        </button>
        {userMenuOpen && (
          <div
            className="absolute bottom-full left-3 right-3 mb-2 rounded-xl border border-border/60 overflow-hidden"
            style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-elegant)" }}
          >
            <Link to="/admin/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-accent/50 transition-colors">
              <UserCog className="w-4 h-4" /> My profile
            </Link>
            <Link to="/" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-accent/50 transition-colors border-t border-border/60">
              <ExternalLink className="w-4 h-4" /> View site
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors border-t border-border/60"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="admin-shell h-screen overflow-hidden bg-background flex">
      <aside
        className="hidden lg:flex w-64 flex-col border-r border-border/60 shrink-0 h-screen sticky top-0"
        style={{ background: "var(--gradient-surface)" }}
      >
        {sidebarContent}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside
            className="absolute left-0 top-0 bottom-0 w-72 border-r border-border/60 flex flex-col"
            style={{ background: "var(--gradient-surface)" }}
          >
            <div className="absolute top-3 right-3 z-10">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 border-b border-border/60 bg-card/50 backdrop-blur-md flex items-center justify-between gap-4 px-4 md:px-6 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Admin</div>
              <h1 className="text-base font-semibold text-foreground truncate leading-tight">
                {currentItem?.label ?? "Dashboard"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AdminInstallButton />
            <NotificationCenter />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
