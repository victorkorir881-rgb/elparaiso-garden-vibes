import { useMemo, useState } from "react";
import { useOrders, useReservations, useMenuItems, useReconciliation } from "@/lib/supabase-hooks";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TrendingUp, ShoppingCart, CalendarCheck, DollarSign, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";

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

// Local-time YYYY-MM-DD key. Using toISOString() drops orders that fall on a
// different UTC day from the local one (in EAT/UTC+3 anything 00:00–02:59 local
// rolls back a day) — they'd vanish from the chart even though they're counted
// in the totals.
function localDayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
      map.set(localDayKey(d), { date: fmtDay(d), orders: 0, revenue: 0, reservations: 0 });
    }
    for (const o of filteredOrders) {
      const row = map.get(localDayKey(new Date(o.created_at)));
      if (!row) continue;
      row.orders += 1;
      if (o.payment_status === "paid" || o.status === "completed") {
        row.revenue += Number(o.total_amount ?? 0);
      }
    }
    for (const r of filteredRes) {
      const row = map.get(localDayKey(new Date(r.created_at)));
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
  // AOV must divide paid revenue by paid order count, NOT by total orders.
  // Otherwise unpaid orders dilute the average down to a tiny number.
  const paidOrdersCount = filteredOrders.filter(
    (o) => o.payment_status === "paid" || o.status === "completed",
  ).length;
  const aov = paidOrdersCount ? totalRevenue / paidOrdersCount : 0;
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

  // Payment reconciliation
  const sinceISO = useMemo(() => since.toISOString(), [since]);
  const { data: recon } = useReconciliation(sinceISO);
  const discrepancyKindLabel: Record<string, string> = {
    "missing-payment": "Paid order, no M-Pesa record",
    "orphan-payment": "Payment without paid order",
    "amount-mismatch": "Amount mismatch",
  };

  const exportReconciliation = () => {
    if (!recon) return;
    const rows = recon.discrepancies.map((d) => ({
      date: new Date(d.created_at).toISOString(),
      type: discrepancyKindLabel[d.kind] ?? d.kind,
      order_number: d.order_number ?? "",
      order_id: d.order_id ?? "",
      order_amount: d.order_amount ?? "",
      payment_amount: d.payment_amount ?? "",
      mpesa_receipt: d.mpesa_receipt ?? "",
      payment_id: d.payment_id ?? "",
    }));
    downloadCsv(`reconciliation_last_${range}d`, rows, [
      { header: "Date", value: "date" },
      { header: "Type", value: "type" },
      { header: "Order Number", value: "order_number" },
      { header: "Order ID", value: "order_id" },
      { header: "Order Amount (KES)", value: "order_amount" },
      { header: "Payment Amount (KES)", value: "payment_amount" },
      { header: "M-Pesa Receipt", value: "mpesa_receipt" },
      { header: "Payment ID", value: "payment_id" },
    ]);
  };

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
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9" }} />
              <Legend wrapperStyle={{ color: "#f1f5f9" }} />
              <Line yAxisId="left" type="monotone" dataKey="orders" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3, fill: "#38bdf8" }} activeDot={{ r: 5 }} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} activeDot={{ r: 5 }} />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={120} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9" }} cursor={{ fill: "rgba(56,189,248,0.08)" }} />
                  <Bar dataKey="qty" fill="#38bdf8" radius={[0, 4, 4, 0]} />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} interval={1} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9" }} cursor={{ fill: "rgba(56,189,248,0.08)" }} />
                <Legend wrapperStyle={{ color: "#f1f5f9" }} />
                <Bar dataKey="orders" stackId="a" fill="#38bdf8" />
                <Bar dataKey="reservations" stackId="a" fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Payment reconciliation */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              {recon && recon.discrepancies.length === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              )}
              Payment Reconciliation
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Cross-checks paid orders against successful M-Pesa payments over the selected window.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportReconciliation}
            disabled={!recon || recon.discrepancies.length === 0}
          >
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Paid orders</div>
            <div className="text-lg font-semibold">{recon?.paidOrdersCount ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{recon ? KSH.format(recon.paidOrdersTotal) : ""}</div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">M-Pesa successes</div>
            <div className="text-lg font-semibold">{recon?.successPaymentsCount ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{recon ? KSH.format(recon.successPaymentsTotal) : ""}</div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Net difference</div>
            <div className="text-lg font-semibold">
              {recon ? KSH.format(recon.paidOrdersTotal - recon.successPaymentsTotal) : "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Discrepancies</div>
            <div className={`text-lg font-semibold ${recon && recon.discrepancies.length > 0 ? "text-yellow-500" : ""}`}>
              {recon?.discrepancies.length ?? "—"}
            </div>
          </div>
        </div>

        {recon && recon.discrepancies.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            All paid orders match an M-Pesa receipt for this window. ✅
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-3">Date</th>
                  <th className="text-left py-2 pr-3">Type</th>
                  <th className="text-left py-2 pr-3">Order #</th>
                  <th className="text-right py-2 pr-3">Order</th>
                  <th className="text-right py-2 pr-3">Payment</th>
                  <th className="text-left py-2">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {recon?.discrepancies.slice(0, 50).map((d, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(d.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-3">{discrepancyKindLabel[d.kind] ?? d.kind}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{d.order_number ?? "—"}</td>
                    <td className="py-2 pr-3 text-right">{d.order_amount != null ? KSH.format(d.order_amount) : "—"}</td>
                    <td className="py-2 pr-3 text-right">{d.payment_amount != null ? KSH.format(d.payment_amount) : "—"}</td>
                    <td className="py-2 font-mono text-xs">{d.mpesa_receipt ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recon && recon.discrepancies.length > 50 && (
              <p className="text-xs text-muted-foreground mt-2">
                Showing first 50 of {recon.discrepancies.length}. Use "Export CSV" for the full list.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
