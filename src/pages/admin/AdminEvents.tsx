import { useState } from "react";
import { Plus, Pencil, Trash2, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent } from "@/lib/supabase-hooks";
import { ImageUploadField } from "@/components/admin/ImageUploadField";

type EventForm = {
  id?: string; title: string; description: string; eventDate: string;
  startTime: string; endTime: string;
  isActive: boolean; isFeatured: boolean; imageUrl?: string;
};

const defaultForm = (): EventForm => ({
  title: "", description: "", eventDate: "", startTime: "", endTime: "",
  isActive: true, isFeatured: false,
});

export default function AdminEvents() {
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState<EventForm>(defaultForm());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: events, isLoading } = useEvents({});
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const save = () => {
    if (!form.title) return toast.error("Title is required");
    if (!form.eventDate) return toast.error("Date is required");
    const payload = {
      title: form.title, description: form.description || undefined,
      event_date: form.eventDate, start_time: form.startTime || undefined, end_time: form.endTime || undefined,
      is_active: form.isActive, is_featured: form.isFeatured, image_url: form.imageUrl,
    };
    if (form.id) {
      updateEvent.mutate({ id: form.id, ...payload }, { onSuccess: () => { setDialog(false); toast.success("Event updated"); } });
    } else {
      createEvent.mutate(payload, { onSuccess: () => { setDialog(false); toast.success("Event created"); } });
    }
  };

  const openEdit = (evt: any) => {
    setForm({ id: evt.id, title: evt.title, description: evt.description ?? "", eventDate: evt.event_date ?? "", startTime: evt.start_time ?? "", endTime: evt.end_time ?? "", isActive: evt.is_active, isFeatured: evt.is_featured, imageUrl: evt.image_url });
    setDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Events & Offers</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage events, specials, and promotions</p>
        </div>
        <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setForm(defaultForm()); setDialog(true); }}>
          <Plus className="w-4 h-4 mr-1" /> New Event
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-card border border-border rounded-xl h-48 animate-pulse" />)}
        </div>
      ) : events && events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((evt) => (
            <div key={evt.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {evt.image_url && (
                <div className="h-36 overflow-hidden">
                  <img src={evt.image_url} alt={evt.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-foreground text-sm">{evt.title}</h3>
                  <div className="flex gap-1 shrink-0">
                    {evt.is_active ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Active</Badge> : <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                    {evt.is_featured && <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Featured</Badge>}
                  </div>
                </div>
                {(evt.event_date || evt.start_time) && (
                  <div className="flex gap-3 text-xs text-muted-foreground mb-3">
                    {evt.event_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{evt.event_date}</span>}
                    {evt.start_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{evt.start_time}</span>}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1 border-border text-foreground hover:bg-accent text-xs" onClick={() => openEdit(evt)}>
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive text-xs" onClick={() => setDeleteConfirm(evt.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground">No events yet. Create your first event or special offer.</p>
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit Event" : "Create Event"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-foreground">Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="Event title" />
            </div>
            <div>
              <Label className="text-foreground">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="bg-input border-border text-foreground mt-1 resize-none" rows={3} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-foreground">Date *</Label>
                <Input type="date" value={form.eventDate} onChange={(e) => setForm((p) => ({ ...p, eventDate: e.target.value }))} className="bg-input border-border text-foreground mt-1" />
              </div>
              <div>
                <Label className="text-foreground">Start Time</Label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))} className="bg-input border-border text-foreground mt-1" />
              </div>
              <div>
                <Label className="text-foreground">End Time</Label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))} className="bg-input border-border text-foreground mt-1" />
              </div>
            </div>
            <ImageUploadField
              value={form.imageUrl ?? ""}
              onChange={(url) => setForm((p) => ({ ...p, imageUrl: url }))}
              folder="events"
              label="Image"
            />
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))} />
                <Label className="text-foreground">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.isFeatured} onCheckedChange={(v) => setForm((p) => ({ ...p, isFeatured: v }))} />
                <Label className="text-foreground">Featured</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setDialog(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" onClick={save} disabled={createEvent.isPending || updateEvent.isPending}>
              {createEvent.isPending || updateEvent.isPending ? "Saving..." : "Save Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader><DialogTitle>Delete Event</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">Are you sure you want to delete this event?</p>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteEvent.mutate(deleteConfirm, { onSuccess: () => { setDeleteConfirm(null); toast.success("Event deleted"); } })}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
