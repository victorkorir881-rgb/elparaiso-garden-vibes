import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, MessageSquare, UtensilsCrossed, CalendarDays,
  Star, Settings, LogOut, Users, BookOpen, Menu, X, ArrowLeft
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: MessageSquare, label: "Conversations", href: "/admin/conversations" },
  { icon: BookOpen, label: "FAQs", href: "/admin/faqs" },
  { icon: UtensilsCrossed, label: "Menu", href: "/admin/menu" },
  { icon: Users, label: "Reservations", href: "/admin/reservations" },
  { icon: CalendarDays, label: "Events", href: "/admin/events" },
  { icon: Star, label: "Reviews", href: "/admin/reviews" },
  { icon: Settings, label: "Settings", href: "/admin/settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, adminRole, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-card border border-border rounded-lg p-2 text-foreground"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-200 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border">
            <h2 className="font-display text-lg font-bold text-gradient-fire tracking-wider">ELPARAISO</h2>
            <p className="text-xs text-muted-foreground mt-1">Admin Panel</p>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  location.pathname === item.href
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
            <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-muted-foreground hover:text-destructive">
              <LogOut size={16} className="mr-2" /> Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="flex-1 md:ml-64 p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-end mb-4">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft size={14} className="mr-2" /> View Site
              </Button>
            </Link>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
