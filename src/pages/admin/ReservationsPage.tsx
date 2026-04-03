import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Check, X, Trash2 } from "lucide-react";

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    const { data } = await supabase.from("reservation_leads").select("*").order("created_at", { ascending: false });
    setReservations(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("reservation_leads").update({ status }).eq("id", id);
    toast({ title: `Reservation ${status}` });
    fetchData();
  };

  const deleteRes = async (id: string) => {
    if (!confirm("Delete this reservation?")) return;
    await supabase.from("reservation_leads").delete().eq("id", id);
    toast({ title: "Reservation deleted" });
    fetchData();
  };

  const statusColor = (s: string) => {
    if (s === "confirmed") return "text-green-400";
    if (s === "cancelled") return "text-red-400";
    return "text-amber";
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Reservations</h1>
      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.phone}</TableCell>
                  <TableCell>{r.date ? format(new Date(r.date), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell>{r.time || "—"}</TableCell>
                  <TableCell>{r.party_size || "—"}</TableCell>
                  <TableCell><span className={`capitalize font-medium ${statusColor(r.status)}`}>{r.status}</span></TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.status === "new" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => updateStatus(r.id, "confirmed")} className="text-green-400"><Check size={14} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => updateStatus(r.id, "cancelled")} className="text-red-400"><X size={14} /></Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => deleteRes(r.id)} className="text-destructive"><Trash2 size={14} /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {reservations.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No reservations yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminLayout>
  );
}
