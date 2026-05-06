import { useState } from "react";
import { Mail, MailOpen, Trash2, Phone, Search, Download, CheckSquare } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useContactMessages, useUpdateContactMessage, useDeleteContactMessage } from "@/lib/supabase-hooks";
import { BulkActionBar } from "@/components/admin/BulkActionBar";

export default function AdminMessages() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const { data: messages, isLoading } = useContactMessages({
    isRead: filter === "unread" ? false : undefined,
  });

  const markRead = useUpdateContactMessage();
  const del = useDeleteContactMessage();

  const openMessage = (msg: any) => {
    setSelected(msg);
    if (!msg.is_read) markRead.mutate({ id: msg.id, is_read: true });
  };

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const clearPicked = () => setPicked(new Set());

  const bulkMarkRead = async (value: boolean) => {
    const ids = Array.from(picked);
    await Promise.allSettled(ids.map((id) => markRead.mutateAsync({ id, is_read: value })));
    toast.success(`Marked ${ids.length} as ${value ? "read" : "unread"}`);
    clearPicked();
  };

  const bulkDelete = async () => {
    const ids = Array.from(picked);
    const results = await Promise.allSettled(ids.map((id) => del.mutateAsync(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed) toast.error(`${failed} of ${ids.length} failed to delete`);
    else toast.success(`Deleted ${ids.length} message${ids.length > 1 ? "s" : ""}`);
    clearPicked();
    setBulkDeleteConfirm(false);
  };

  const unreadCount = messages?.filter((m) => !m.is_read).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground text-sm mt-1">
          {unreadCount > 0 ? <span className="text-primary font-medium">{unreadCount} unread</span> : "All messages read"} · {messages?.length ?? 0} total
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-border text-foreground hover:bg-accent"
          disabled={!messages || messages.length === 0}
          onClick={() =>
            downloadCsv("messages", messages ?? [], [
              { header: "Received", value: (m) => m.created_at },
              { header: "Name", value: "name" },
              { header: "Email", value: "email" },
              { header: "Phone", value: (m) => m.phone ?? "" },
              { header: "Inquiry Type", value: (m) => m.inquiry_type ?? "" },
              { header: "Read", value: (m) => (m.is_read ? "yes" : "no") },
              { header: "Message", value: "message" },
            ])
          }
        >
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search messages..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36 bg-card border-border text-foreground"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all" className="text-foreground">All Messages</SelectItem>
            <SelectItem value="unread" className="text-foreground">Unread Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <BulkActionBar count={picked.size} onClear={clearPicked}>
        <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-accent" onClick={() => bulkMarkRead(true)}>
          <MailOpen className="w-4 h-4 mr-1" /> Mark read
        </Button>
        <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-accent" onClick={() => bulkMarkRead(false)}>
          <Mail className="w-4 h-4 mr-1" /> Mark unread
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setBulkDeleteConfirm(true)}>
          <Trash2 className="w-4 h-4 mr-1" /> Delete
        </Button>
      </BulkActionBar>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : messages && messages.length > 0 ? (
          <div className="divide-y divide-border">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-4 px-4 py-4 cursor-pointer hover:bg-accent/20 transition-colors ${!msg.is_read ? "bg-primary/5" : ""} ${picked.has(msg.id) ? "ring-1 ring-primary/40" : ""}`}
                onClick={() => openMessage(msg)}
              >
                <div onClick={(e) => e.stopPropagation()} className="mt-1 shrink-0">
                  <Checkbox checked={picked.has(msg.id)} onCheckedChange={() => togglePick(msg.id)} />
                </div>
                <div className={`mt-1 shrink-0 ${!msg.is_read ? "text-primary" : "text-muted-foreground"}`}>
                  {msg.is_read ? <MailOpen className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm ${!msg.is_read ? "text-foreground" : "text-muted-foreground"}`}>{msg.name}</span>
                      {!msg.is_read && <Badge className="bg-primary/20 text-primary border-primary/30 text-xs px-1.5 py-0">New</Badge>}
                      {msg.inquiry_type && <span className="text-xs text-muted-foreground hidden sm:inline">· {msg.inquiry_type}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(msg.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{msg.message}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{msg.email}</span>
                    {msg.phone && <span>· {msg.phone}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(msg.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Mail className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No messages yet.</p>
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">{selected?.inquiry_type || "Message"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="bg-background border border-border rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">From:</span>
                  <span className="text-foreground font-medium">{selected.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <a href={`mailto:${selected.email}`} className="text-primary hover:underline">{selected.email}</a>
                </div>
                {selected.phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone:</span>
                    <a href={`tel:${selected.phone}`} className="text-primary hover:underline">{selected.phone}</a>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="text-foreground">{new Date(selected.created_at).toLocaleString()}</span>
                </div>
              </div>
              <div className="bg-background border border-border rounded-xl p-4">
                <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">{selected.message}</p>
              </div>
              <div className="flex gap-2">
                <a href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.inquiry_type || "Your inquiry at Elparaiso Garden")}`} className="flex-1">
                  <Button className="w-full bg-primary text-primary-foreground">Reply via Email</Button>
                </a>
                {selected.phone && (
                  <a href={`https://wa.me/${selected.phone.replace(/\D/g, "").replace(/^0/, "254")}?text=Hi%20${encodeURIComponent(selected.name)}%2C%20thank%20you%20for%20contacting%20Elparaiso%20Garden!`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="border-border text-foreground hover:bg-accent">
                      <Phone className="w-4 h-4" />
                    </Button>
                  </a>
                )}
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => {
                  markRead.mutate({ id: selected.id, is_read: !selected.is_read });
                  setSelected((p: any) => ({ ...p, is_read: !p.is_read }));
                }}>
                  {selected.is_read ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader><DialogTitle>Delete Message</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">Are you sure you want to delete this message?</p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-accent" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => deleteConfirm && del.mutate(deleteConfirm, { onSuccess: () => { setDeleteConfirm(null); toast.success("Message deleted"); } })}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader><DialogTitle>Delete {picked.size} messages?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">This action cannot be undone.</p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-accent" onClick={() => setBulkDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={bulkDelete}>Delete all</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
