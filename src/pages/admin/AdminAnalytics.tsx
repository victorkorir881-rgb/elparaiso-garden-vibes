import { useMemo, useState } from "react";
import { useOrders, useReservations, useMenuItems } from "@/lib/supabase-hooks";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TrendingUp, ShoppingCart, CalendarCheck, DollarSign } from "lucide-react";

type Range = 7 | 14 | 30 | 90;

interface OrderItem { id?: string; name?: string; quantity?: number; price?: number }

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const KSH = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

export default function AdminAnalytics() {
  const [range, setRange] = useState<Range>(30);
  const { data: orders = [], isLoading: lo } = useOrders({});
  const { data: reservations = [], isLoading: lr } = useReservations({});
  const { data: menuItems = [] } = useMenuItems({});

  const since = useMemo(() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - (range - 1));
    return d;
  }, [range]);

  const filteredOrders = useMemo(
    () => (orders as any[]).filter((o) => new Date(o.created_at) >= since),
    [orders, since],
  );
  const filteredRes = useMemo(
    () => (reservations as any[]).filter((r) => new Date(r.created_at) >= since),
    [reservations, since],
  );

  // Daily series
  const daily = useMemo(() => {
    const map = new Map<string, { date: string; orders: number; revenue: number; reservations: number }>();
    for (let i = 0; i < range; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { date: fmtDay(d), orders: 0, revenue: 0, reservations: 0 });
    }
    for (const o of filteredOrders) {
      const key = new Date(o.created_at).toISOString().slice(0, 10);
      const row = map.get(key);
      if (!row) continue;
      row.orders += 1;
      if (o.payment_status === "paid" || o.status === "completed") {
        row.revenue += Number(o.total_amount ?? 0);
      }
    }
    for (const r of filteredRes) {
      const key = new Date(r.created_at).toISOString().slice(0, 10);
      const row = map.get(key);
      if (row) row.reservations += 1;
    }
    return Array.from(map.values());
  }, [filteredOrders, filteredRes, range, since]);

  // Top items
  const topItems = useMemo(() => {
    const counts = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of filteredOrders) {
      const items = (Array.isArray(o.items) ? o.items : []) as OrderItem[];
      for (const it of items) {
        const name = it.name || "Unknown";
        const qty = Number(it.quantity ?? 1);
        const price = Number(it.price ?? 0);
        const cur = counts.get(name) ?? { name, qty: 0, revenue: 0 };
        cur.qty += qty;
        cur.revenue += qty * price;
        counts.set(name, cur);
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [filteredOrders]);

  // Peak hours (orders by hour-of-day)
  const peakHours = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, orders: 0, reservations: 0 }));
    for (const o of filteredOrders) arr[new Date(o.created_at).getHours()].orders++;
    for (const r of filteredRes) arr[new Date(r.created_at).getHours()].reservations++;
    return arr;
  }, [filteredOrders, filteredRes]);

  const totalOrders = filteredOrders.length;
  const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
  const aov = totalOrders ? totalRevenue / totalOrders : 0;
  const totalRes = filteredRes.length;
  const confirmedRes = filteredRes.filter((r) => r.status === "confirmed" || r.status === "completed").length;
  const conversionRate = totalRes ? (confirmedRes / totalRes) * 100 : 0;

  const stats = [
    { label: "Total Orders", value: totalOrders.toLocaleString(), icon: ShoppingCart, color: "text-green-400" },
    { label: "Revenue (paid)", value: KSH.format(totalRevenue), icon: DollarSign, color: "text-primary" },
    { label: "Avg. Order Value", value: KSH.format(aov), icon: TrendingUp, color: "text-blue-400" },
    { label: "Reservation Conv.", value: `${conversionRate.toFixed(1)}%`, icon: CalendarCheck, color: "text-purple-400" },
  ];

  const loading = lo || lr;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {menuItems.length} menu items tracked · last {range} days
          </p>
        </div>
        <Select value={String(range)} onValueChange={(v) => setRange(Number(v) as Range)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className={`text-2xl font-bold ${s.color} mb-1`}>{loading ? "—" : s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Orders &amp; Revenue per Day</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="orders" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Top 10 Menu Items</h2>
          <div className="h-80">
            {topItems.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No order data in range</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topItems} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Peak Hours</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={1} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="orders" stackId="a" fill="hsl(var(--primary))" />
                <Bar dataKey="reservations" stackId="a" fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
