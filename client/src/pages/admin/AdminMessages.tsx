import { useState } from "react";
import { Mail, MailOpen, Trash2, Phone, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function AdminMessages() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: messages, isLoading } = trpc.contact.list.useQuery({
    isRead: filter === "unread" ? false : undefined,
  });

  const markRead = trpc.contact.markRead.useMutation({ onSuccess: () => utils.contact.list.invalidate() });
  // markUnread uses same markRead mutation with isRead:false
  const del = trpc.contact.delete.useMutation({ onSuccess: () => { utils.contact.list.invalidate(); setDeleteConfirm(null); toast.success("Message deleted"); } });

  const openMessage = (msg: any) => {
    setSelected(msg);
    if (!msg.isRead) markRead.mutate({ id: msg.id, isRead: true });
  };

  const unreadCount = messages?.filter((m) => !m.isRead).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {unreadCount > 0 ? <span className="text-primary font-medium">{unreadCount} unread</span> : "All messages read"} · {messages?.length ?? 0} total
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search messages..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36 bg-card border-border text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all" className="text-foreground">All Messages</SelectItem>
            <SelectItem value="unread" className="text-foreground">Unread Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : messages && messages.length > 0 ? (
          <div className="divide-y divide-border">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-4 px-4 py-4 cursor-pointer hover:bg-accent/20 transition-colors ${!msg.isRead ? "bg-primary/5" : ""}`}
                onClick={() => openMessage(msg)}
              >
                <div className={`mt-1 shrink-0 ${!msg.isRead ? "text-primary" : "text-muted-foreground"}`}>
                  {msg.isRead ? <MailOpen className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm ${!msg.isRead ? "text-foreground" : "text-muted-foreground"}`}>{msg.name}</span>
                      {!msg.isRead && <Badge className="bg-primary/20 text-primary border-primary/30 text-xs px-1.5 py-0">New</Badge>}
                      {msg.inquiryType && <span className="text-xs text-muted-foreground hidden sm:inline">· {msg.inquiryType}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(msg.createdAt).toLocaleDateString()}</span>
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

      {/* Message Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">{selected?.inquiryType || "Message"}</DialogTitle>
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
                  <span className="text-foreground">{new Date(selected.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="bg-background border border-border rounded-xl p-4">
                <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">{selected.message}</p>
              </div>
              <div className="flex gap-2">
                <a href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.inquiryType || "Your inquiry at Elparaiso Garden")}`} className="flex-1">
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
                  if (selected.isRead) markRead.mutate({ id: selected.id, isRead: false });
                  else markRead.mutate({ id: selected.id, isRead: true });
                  setSelected((p: any) => ({ ...p, isRead: !p.isRead }));
                }}>
                  {selected.isRead ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader><DialogTitle>Delete Message</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">Are you sure you want to delete this message?</p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-accent" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => deleteConfirm && del.mutate({ id: deleteConfirm })}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
