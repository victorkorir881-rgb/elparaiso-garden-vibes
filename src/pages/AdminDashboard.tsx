import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  MessageSquare, UtensilsCrossed, Users, Star, ArrowLeft
} from "lucide-react";

export default function AdminDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalConversations: 0, totalReservations: 0, totalMenuItems: 0, totalReviews: 0, pendingReservations: 0 });

  useEffect(() => {
    if (!loading && !user) navigate("/admin/login");
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
      setStats({ totalConversations: convos.count ?? 0, totalReservations: reservations.count ?? 0, totalMenuItems: menuItems.count ?? 0, totalReviews: reviews.count ?? 0, pendingReservations: pendingRes });
    };
    fetchStats();
  }, [user, isAdmin]);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;

  if (!isAdmin) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground">You do not have admin privileges.</p>
        <Button onClick={() => navigate("/")} variant="outline"><ArrowLeft size={16} className="mr-2" /> Back to site</Button>
      </div>
    </div>
  );

  const statCards = [
    { label: "Conversations", value: stats.totalConversations, icon: MessageSquare, color: "text-blue-400", },
    { label: "Reservations", value: stats.totalReservations, icon: Users, color: "text-green-400", sub: `${stats.pendingReservations} pending` },
    { label: "Menu Items", value: stats.totalMenuItems, icon: UtensilsCrossed, color: "text-amber" },
    { label: "Reviews", value: stats.totalReviews, icon: Star, color: "text-yellow-400" },
  ];

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Welcome back! Here's an overview of your business.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon size={18} className={stat.color} />
            </div>
            <p className="text-3xl font-bold text-foreground">{stat.value}</p>
            {stat.sub && <p className="text-xs text-muted-foreground">{stat.sub}</p>}
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
