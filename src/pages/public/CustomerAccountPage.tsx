import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useMyOrders } from "@/lib/supabase-hooks";
import PublicLayout from "@/components/public/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Package, Clock, MapPin, ChevronRight, LogOut, ShoppingBag,
  CheckCircle2, AlertCircle, Receipt, UtensilsCrossed,
} from "lucide-react";

const STATUS_STYLES: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  preparing: { label: "Preparing", tone: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  ready: { label: "Ready", tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  "out-for-delivery": { label: "On the way", tone: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  completed: { label: "Completed", tone: "bg-foreground/10 text-foreground/70 border-border" },
  cancelled: { label: "Cancelled", tone: "bg-destructive/15 text-destructive border-destructive/30" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CustomerAccountPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { data: orders = [], isLoading } = useMyOrders(auth.user?.id);

  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) {
      navigate({ to: "/login", search: { redirect: "/account" } as any });
    }
  }, [auth.loading, auth.isAuthenticated, navigate]);

  if (auth.loading || !auth.isAuthenticated) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PublicLayout>
    );
  }

  const activeOrders = orders.filter((o: any) => !["completed", "cancelled"].includes(o.status));
  const pastOrders = orders.filter((o: any) => ["completed", "cancelled"].includes(o.status));
  const totalSpent = orders
    .filter((o: any) => o.payment_status === "paid")
    .reduce((sum: number, o: any) => sum + parseFloat(o.total_amount || 0), 0);

  return (
    <PublicLayout>
      <div className="relative bg-background py-8 sm:py-12 px-3 sm:px-4 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-32 h-[420px] -z-10 opacity-70"
          style={{ background: "radial-gradient(50% 60% at 50% 0%, oklch(74% 0.11 75 / 0.18), transparent 70%)" }} />
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 sm:mb-10">
            <div>
              <p className="text-sm text-foreground/55 mb-1">Welcome back</p>
              <h1 className="text-3xl sm:text-5xl font-display font-semibold tracking-tight">
                Hi,{" "}
                <span className="italic" style={{ background: "var(--gradient-gold)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  {auth.user?.name?.split(" ")[0] || "friend"}
                </span>
              </h1>
              <p className="text-foreground/55 text-sm mt-2">{auth.user?.email}</p>
            </div>
            <Button variant="outline" onClick={() => auth.signOut()} className="rounded-full self-start sm:self-end">
              <LogOut className="w-4 h-4 mr-1.5" /> Sign out
            </Button>
          </div>

          {/* Stat cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <StatCard icon={ShoppingBag} label="Total orders" value={orders.length.toString()} />
            <StatCard icon={Package} label="In progress" value={activeOrders.length.toString()} accent />
            <StatCard icon={Receipt} label="Lifetime spend" value={`KES ${Math.round(totalSpent).toLocaleString()}`} />
          </div>

          {/* Active orders */}
          {activeOrders.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-display font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Active orders
              </h2>
              <div className="grid gap-3">
                {activeOrders.map((o: any) => <OrderRow key={o.id} order={o} />)}
              </div>
            </section>
          )}

          {/* Order history */}
          <section>
            <h2 className="text-2xl font-display font-semibold mb-4">Order history</h2>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : orders.length === 0 ? (
              <Card className="p-12 text-center border-dashed">
                <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 text-foreground/25" strokeWidth={1.5} />
                <h3 className="text-xl font-display font-semibold mb-2">No orders yet</h3>
                <p className="text-foreground/55 mb-5">When you place an order, it will show up here.</p>
                <Link to="/order">
                  <Button className="rounded-full" style={{ background: "var(--gradient-gold)", color: "var(--primary-foreground)" }}>
                    Browse menu <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </Card>
            ) : pastOrders.length === 0 ? (
              <Card className="p-8 text-center border-dashed text-foreground/55">
                Your past orders will appear here once they are completed.
              </Card>
            ) : (
              <div className="grid gap-3">
                {pastOrders.map((o: any) => <OrderRow key={o.id} order={o} />)}
              </div>
            )}
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <Card
      className={`p-5 relative overflow-hidden ${accent ? "border-primary/30" : "border-border/60"}`}
      style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-soft)" }}
    >
      {accent && (
        <div aria-hidden className="absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-25 blur-2xl"
          style={{ background: "var(--gradient-gold)" }} />
      )}
      <div className="relative flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={accent ? { background: "var(--gradient-gold)" } : { background: "oklch(20% 0.014 55)" }}>
          <Icon className={`w-5 h-5 ${accent ? "text-primary-foreground" : "text-primary"}`} />
        </div>
        <div className="flex-1">
          <p className="text-xs text-foreground/55 uppercase tracking-wider">{label}</p>
          <p className="text-xl font-display font-semibold tracking-tight">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function OrderRow({ order }: { order: any }) {
  const status = STATUS_STYLES[order.status] ?? STATUS_STYLES.pending;
  const itemCount = Array.isArray(order.items) ? order.items.reduce((s: number, i: any) => s + (i.quantity || 1), 0) : 0;
  const paid = order.payment_status === "paid";

  return (
    <Card
      className="p-4 sm:p-5 border-border/60 hover:border-primary/40 transition-colors"
      style={{ background: "var(--gradient-surface)" }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="font-mono text-sm font-semibold text-foreground/80">{order.order_number}</span>
            <Badge variant="outline" className={status.tone}>{status.label}</Badge>
            {paid ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Paid
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                <AlertCircle className="w-3 h-3 mr-1" /> Unpaid
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-foreground/55 flex-wrap">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDate(order.created_at)}</span>
            <span className="flex items-center gap-1 capitalize"><MapPin className="w-3.5 h-3.5" />{order.order_type}</span>
            <span>{itemCount} item{itemCount === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:justify-end">
          <p className="text-lg font-bold text-primary whitespace-nowrap">
            KES {parseFloat(order.total_amount).toLocaleString()}
          </p>
          <Link to="/track" search={{ q: order.order_number } as any}>
            <Button size="sm" variant="outline" className="rounded-full">
              Track <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
