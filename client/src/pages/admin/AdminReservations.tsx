import { useState } from "react";
import { Search, Phone, MessageSquare, Trash2, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useReservations, useUpdateReservation, useDeleteReservation } from "@/lib/supabase-hooks";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  confirmed: "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  new: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

export default function AdminReservations() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [noteDialog, setNoteDialog] = useState<{ id: string; notes: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: reservations, isLoading } = useReservations({
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined,
  });

  const updateRes = useUpdateReservation();
  const deleteRes = useDeleteReservation();

  const updateStatus = (id: string, status: string) => updateRes.mutate({ id, status }, { onSuccess: () => toast.success("Reservation updated") });
  const saveNote = () => {
    if (!noteDialog) return;
    updateRes.mutate({ id: noteDialog.id, notes: noteDialog.notes }, { onSuccess: () => { setNoteDialog(null); toast.success("Note saved"); } });
  };

  const whatsappLink = (phone: string, name: string, date: string | null, time: string | null) => {
    const msg = encodeURIComponent(`Hi ${name}! Your reservation at Elparaiso Garden for ${date ?? "your date"} at ${time ?? "your time"} is confirmed. See you soon! 🍽️`);
    const cleaned = phone.replace(/\D/g, "");
    const intl = cleaned.startsWith("0") ? "254" + cleaned.slice(1) : cleaned;
    return `https://wa.me/${intl}?text=${msg}`;
  };

  const counts = {
    all: reservations?.length ?? 0,
    pending: reservations?.filter((r) => r.status === "pending" || r.status === "new").length ?? 0,
    confirmed: reservations?.filter((r) => r.status === "confirmed").length ?? 0,
    cancelled: reservations?.filter((r) => r.status === "cancelled").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reservations</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage table reservations and bookings</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", count: counts.all, color: "text-foreground" },
          { label: "Pending", count: counts.pending, color: "text-yellow-400" },
          { label: "Confirmed", count: counts.confirmed, color: "text-green-400" },
          { label: "Cancelled", count: counts.cancelled, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-card border-border text-foreground"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all" className="text-foreground">All Status</SelectItem>
            <SelectItem value="new" className="text-foreground">New</SelectItem>
            <SelectItem value="pending" className="text-foreground">Pending</SelectItem>
            <SelectItem value="confirmed" className="text-foreground">Confirmed</SelectItem>
            <SelectItem value="cancelled" className="text-foreground">Cancelled</SelectItem>
            <SelectItem value="completed" className="text-foreground">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Guest</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Date & Time</th>
                <th className="text-center px-4 py-3 text-muted-foreground font-medium">Guests</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Loading...</td></tr>
              ) : reservations && reservations.length > 0 ? (
                reservations.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.phone}</div>
                      {r.notes && <div className="text-xs text-muted-foreground italic mt-0.5 max-w-xs truncate">"{r.notes}"</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-foreground">{r.date}</div>
                      <div className="text-xs text-muted-foreground">{r.time}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-foreground">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        {r.party_size}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                        <SelectTrigger className={`w-32 h-7 text-xs border rounded-full px-3 ${STATUS_COLORS[r.status] ?? STATUS_COLORS.pending}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {["new", "pending", "confirmed", "cancelled", "completed"].map((s) => (
                            <SelectItem key={s} value={s} className="text-foreground capitalize">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a href={`tel:${r.phone}`} title="Call">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-green-400">
                            <Phone className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                        <a href={whatsappLink(r.phone, r.name, r.date, r.time)} target="_blank" rel="noopener noreferrer" title="WhatsApp">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-green-400">
                            <MessageSquare className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Add note" onClick={() => setNoteDialog({ id: r.id, notes: r.notes ?? "" })}>
                          <Clock className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteConfirm(r.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No reservations found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!noteDialog} onOpenChange={() => setNoteDialog(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader><DialogTitle>Admin Note</DialogTitle></DialogHeader>
          <div>
            <Label className="text-foreground">Notes</Label>
            <Textarea value={noteDialog?.notes ?? ""} onChange={(e) => setNoteDialog((p) => p ? { ...p, notes: e.target.value } : null)} className="bg-input border-border text-foreground mt-1 resize-none" rows={4} placeholder="Internal notes about this reservation..." />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setNoteDialog(null)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" onClick={saveNote}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader><DialogTitle>Delete Reservation</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">Are you sure you want to delete this reservation?</p>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteRes.mutate(deleteConfirm, { onSuccess: () => { setDeleteConfirm(null); toast.success("Reservation deleted"); } })}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
