import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollText, RefreshCw, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type LogRow = {
  id: string;
  admin_id: string;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: any;
  new_data: any;
  created_at: string;
  admin?: { full_name: string | null; email: string | null } | null;
};

const PAGE_SIZE = 50;

export default function AdminAuditLog() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [adminFilter, setAdminFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<LogRow | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-activity-log", { actionFilter, tableFilter, adminFilter, dateFrom, dateTo, page }],
    queryFn: async () => {
      let q = supabase
        .from("admin_activity_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      if (tableFilter !== "all") q = q.eq("table_name", tableFilter);
      if (adminFilter !== "all") q = q.eq("admin_id", adminFilter);
      if (dateFrom) q = q.gte("created_at", new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }

      const { data: rows, error, count } = await q;
      if (error) throw error;

      // Hydrate admin profiles in a single follow-up query
      const adminIds = Array.from(new Set((rows ?? []).map((r) => r.admin_id).filter(Boolean)));
      let adminMap: Record<string, { full_name: string | null; email: string | null }> = {};
      if (adminIds.length) {
        const { data: profiles } = await supabase
          .from("admin_profiles")
          .select("id, full_name, email")
          .in("id", adminIds);
        for (const p of profiles ?? []) {
          adminMap[p.id] = { full_name: p.full_name, email: p.email };
        }
      }

      const hydrated: LogRow[] = (rows ?? []).map((r) => ({
        ...r,
        admin: adminMap[r.admin_id] ?? null,
      }));

      return { rows: hydrated, count: count ?? 0 };
    },
  });

  const { data: distinct } = useQuery({
    queryKey: ["admin-activity-log-distinct"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("admin_activity_log")
        .select("action, table_name, admin_id")
        .order("created_at", { ascending: false })
        .limit(500);
      const actions = new Set<string>();
      const tables = new Set<string>();
      const admins = new Set<string>();
      (rows ?? []).forEach((r) => {
        if (r.action) actions.add(r.action);
        if (r.table_name) tables.add(r.table_name);
        if (r.admin_id) admins.add(r.admin_id);
      });

      let adminMap: Record<string, string> = {};
      if (admins.size) {
        const { data: profs } = await supabase
          .from("admin_profiles")
          .select("id, full_name, email")
          .in("id", Array.from(admins));
        for (const p of profs ?? []) {
          adminMap[p.id] = p.full_name || p.email || p.id.slice(0, 8);
        }
      }

      return {
        actions: Array.from(actions).sort(),
        tables: Array.from(tables).sort(),
        admins: Array.from(admins).map((id) => ({ id, label: adminMap[id] ?? id.slice(0, 8) })),
      };
    },
    staleTime: 60_000,
  });

  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    if (!search.trim()) return data.rows;
    const q = search.toLowerCase();
    return data.rows.filter((r) =>
      [r.action, r.table_name, r.record_id, r.admin?.full_name, r.admin?.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data?.rows, search]);

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  const exportCsv = () => {
    const rows = filteredRows;
    const header = ["timestamp", "admin", "action", "table", "record_id"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const adminName = r.admin?.full_name || r.admin?.email || r.admin_id;
      const cells = [r.created_at, adminName, r.action, r.table_name ?? "", r.record_id ?? ""].map(
        (c) => `"${String(c ?? "").replace(/"/g, '""')}"`,
      );
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const actionVariant = (a: string): "default" | "secondary" | "destructive" | "outline" => {
    const k = a.toLowerCase();
    if (k.includes("delete") || k.includes("remove")) return "destructive";
    if (k.includes("create") || k.includes("insert") || k.includes("add")) return "default";
    if (k.includes("update") || k.includes("edit")) return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Audit Log</h1>
            <p className="text-sm text-muted-foreground">
              All admin actions across the system. {data?.count ?? 0} total entries.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={exportCsv} disabled={!filteredRows.length}>
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <Input
            placeholder="Search action, table, record…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="lg:col-span-2"
          />
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {distinct?.actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tableFilter} onValueChange={(v) => { setTableFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Table" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tables</SelectItem>
              {distinct?.tables.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={adminFilter} onValueChange={(v) => { setAdminFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Admin" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All admins</SelectItem>
              {distinct?.admins.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} />
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} />
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">When</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Record</TableHead>
              <TableHead className="w-[80px] text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No log entries match your filters.</TableCell></TableRow>
            ) : (
              filteredRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    <div className="text-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="text-foreground">{r.admin?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.admin?.email ?? r.admin_id.slice(0, 8)}</div>
                  </TableCell>
                  <TableCell><Badge variant={actionVariant(r.action)}>{r.action}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.table_name ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{r.record_id ? r.record_id.slice(0, 8) + "…" : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setSelected(r)} aria-label="View details">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Activity details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Action" value={selected.action} />
                <Field label="Table" value={selected.table_name ?? "—"} />
                <Field label="Record ID" value={selected.record_id ?? "—"} mono />
                <Field label="Admin" value={selected.admin?.full_name ?? selected.admin_id} />
                <Field label="Email" value={selected.admin?.email ?? "—"} />
                <Field label="Timestamp" value={new Date(selected.created_at).toLocaleString()} />
              </div>
              <DiffBlock label="Old data" value={selected.old_data} />
              <DiffBlock label="New data" value={selected.new_data} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-foreground ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</div>
    </div>
  );
}

function DiffBlock({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <pre className="bg-muted/50 border border-border rounded-md p-3 text-xs overflow-x-auto max-h-64">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
