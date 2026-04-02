import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, MessageSquare, UtensilsCrossed, CalendarDays,
  Star, Settings, LogOut, Users, BookOpen, ArrowLeft, Menu, X
} from "lucide-react";

interface DashboardStats {
  totalConversations: number;
  totalReservations: number;
  totalMenuItems: number;
  totalReviews: number;
  pendingReservations: number;
}

export default function AdminDashboard() {
  const { user, isAdmin, adminRole, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalConversations: 0,
    totalReservations: 0,
    totalMenuItems: 0,
    totalReviews: 0,
    pendingReservations: 0,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/admin/login");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user || !isAdmin) return;

    const fetchStats = async () => {
      const [convos, reservations, menuItems, reviews] = await Promise.all([
        supabase.from("chatbot_conversations").select("id", { count: "exact", head: true }),
        supabase.from("reservation_leads").select("id, status", { count: "exact" }),
        supabase.from("menu_items").select("id", { count: "exact", head: true }),
        supabase.from("reviews").select("id", { count: "exact", head: true }),
      ]);

      const pendingRes = reservations.data?.filter(r => r.status === "new").length ?? 0;

      setStats({
        totalConversations: convos.count ?? 0,
        totalReservations: reservations.count ?? 0,
        totalMenuItems: menuItems.count ?? 0,
        totalReviews: reviews.count ?? 0,
        pendingReservations: pendingRes,
      });
    };

    fetchStats();
  }, [user, isAdmin]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">You do not have admin privileges.</p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft size={16} className="mr-2" /> Back to site
          </Button>
        </div>
      </div>
    );
  }

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin", active: true },
    { icon: MessageSquare, label: "Conversations", href: "/admin/conversations" },
    { icon: BookOpen, label: "FAQs", href: "/admin/faqs" },
    { icon: UtensilsCrossed, label: "Menu", href: "/admin/menu" },
    { icon: Users, label: "Reservations", href: "/admin/reservations" },
    { icon: CalendarDays, label: "Events", href: "/admin/events" },
    { icon: Star, label: "Reviews", href: "/admin/reviews" },
    { icon: Settings, label: "Settings", href: "/admin/settings" },
  ];

  const statCards = [
    { label: "Conversations", value: stats.totalConversations, icon: MessageSquare, color: "text-blue-400" },
    { label: "Reservations", value: stats.totalReservations, icon: Users, color: "text-green-400", sub: `${stats.pendingReservations} pending` },
    { label: "Menu Items", value: stats.totalMenuItems, icon: UtensilsCrossed, color: "text-amber" },
    { label: "Reviews", value: stats.totalReviews, icon: Star, color: "text-yellow-400" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-card border border-border rounded-lg p-2 text-foreground"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-200 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border">
            <h2 className="font-display text-lg font-bold text-gradient-fire tracking-wider">
              ELPARAISO
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Admin Panel</p>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  item.active
                    ? "bg-primary/10 text-amber"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-border space-y-3">
            <div className="px-3">
              <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{adminRole}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="w-full justify-start text-muted-foreground hover:text-destructive"
            >
              <LogOut size={16} className="mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-64 p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground text-sm">
                Welcome back! Here's an overview of your business.
              </p>
            </div>
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft size={14} className="mr-2" />
                View Site
              </Button>
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((stat) => (
              <div
                key={stat.label}
                className="bg-card border border-border rounded-xl p-5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <stat.icon size={18} className={stat.color} />
                </div>
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                {stat.sub && (
                  <p className="text-xs text-muted-foreground">{stat.sub}</p>
                )}
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {navItems.slice(1).map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-amber/50 hover:bg-muted/30 transition-colors text-center"
                >
                  <item.icon size={24} className="text-muted-foreground" />
                  <span className="text-sm text-foreground">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
