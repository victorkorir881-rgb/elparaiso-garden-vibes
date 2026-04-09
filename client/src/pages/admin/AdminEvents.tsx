import { useState, useRef } from "react";
import { Plus, Pencil, Trash2, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type EventForm = {
  id?: number; title: string; subtitle: string; description: string; eventDate: string;
  startTime: string; endTime: string; ctaLabel: string; ctaUrl: string;
  isActive: boolean; showOnHomepage: boolean; imageBase64?: string; imageMime?: string; imagePreview?: string;
};

const defaultForm = (): EventForm => ({
  title: "", subtitle: "", description: "", eventDate: "", startTime: "", endTime: "",
  ctaLabel: "", ctaUrl: "", isActive: true, showOnHomepage: false,
});

export default function AdminEvents() {
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState<EventForm>(defaultForm());
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: events, isLoading } = trpc.events.list.useQuery({ activeOnly: false });

  const createEvent = trpc.events.create.useMutation({ onSuccess: () => { utils.events.list.invalidate(); setDialog(false); toast.success("Event created"); } });
  const updateEvent = trpc.events.update.useMutation({ onSuccess: () => { utils.events.list.invalidate(); setDialog(false); toast.success("Event updated"); } });
  const deleteEvent = trpc.events.delete.useMutation({ onSuccess: () => { utils.events.list.invalidate(); setDeleteConfirm(null); toast.success("Event deleted"); } });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm((p) => ({ ...p, imageBase64: ev.target?.result as string, imageMime: file.type, imagePreview: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!form.title) return toast.error("Title is required");
    const payload = {
      title: form.title, subtitle: form.subtitle || undefined, description: form.description || undefined,
      eventDate: form.eventDate || undefined, startTime: form.startTime || undefined, endTime: form.endTime || undefined,
      ctaLabel: form.ctaLabel || undefined, ctaUrl: form.ctaUrl || undefined,
      isActive: form.isActive, showOnHomepage: form.showOnHomepage,
      imageBase64: form.imageBase64, imageMime: form.imageMime,
    };
    if (form.id) updateEvent.mutate({ id: form.id, ...payload });
    else createEvent.mutate(payload);
  };

  const openEdit = (evt: any) => {
    setForm({ id: evt.id, title: evt.title, subtitle: evt.subtitle ?? "", description: evt.description ?? "", eventDate: evt.eventDate ?? "", startTime: evt.startTime ?? "", endTime: evt.endTime ?? "", ctaLabel: evt.ctaLabel ?? "", ctaUrl: evt.ctaUrl ?? "", isActive: evt.isActive, showOnHomepage: evt.showOnHomepage, imagePreview: evt.imageUrl });
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
              {evt.imageUrl && (
                <div className="h-36 overflow-hidden">
                  <img src={evt.imageUrl} alt={evt.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-foreground text-sm">{evt.title}</h3>
                  <div className="flex gap-1 shrink-0">
                    {evt.isActive ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Active</Badge> : <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                    {evt.showOnHomepage && <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Homepage</Badge>}
                  </div>
                </div>
                {evt.subtitle && <p className="text-primary text-xs mb-1">{evt.subtitle}</p>}
                {(evt.eventDate || evt.startTime) && (
                  <div className="flex gap-3 text-xs text-muted-foreground mb-3">
                    {evt.eventDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{evt.eventDate}</span>}
                    {evt.startTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{evt.startTime}</span>}
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

      {/* Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit Event" : "Create Event"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-foreground">Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="Event title" />
            </div>
            <div>
              <Label className="text-foreground">Subtitle / Tagline</Label>
              <Input value={form.subtitle} onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="e.g. Every Friday Night" />
            </div>
            <div>
              <Label className="text-foreground">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="bg-input border-border text-foreground mt-1 resize-none" rows={3} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-foreground">Date</Label>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground">CTA Label</Label>
                <Input value={form.ctaLabel} onChange={(e) => setForm((p) => ({ ...p, ctaLabel: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="e.g. Book Now" />
              </div>
              <div>
                <Label className="text-foreground">CTA URL</Label>
                <Input value={form.ctaUrl} onChange={(e) => setForm((p) => ({ ...p, ctaUrl: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="https://..." />
              </div>
            </div>
            <div>
              <Label className="text-foreground">Image</Label>
              <div className="mt-1 flex items-center gap-3">
                {form.imagePreview && <img src={form.imagePreview} alt="preview" className="w-16 h-16 rounded-lg object-cover" />}
                <Button type="button" variant="outline" size="sm" className="border-border text-foreground hover:bg-accent" onClick={() => fileRef.current?.click()}>
                  {form.imagePreview ? "Change Image" : "Upload Image"}
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))} />
                <Label className="text-foreground">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.showOnHomepage} onCheckedChange={(v) => setForm((p) => ({ ...p, showOnHomepage: v }))} />
                <Label className="text-foreground">Show on Homepage</Label>
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

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader><DialogTitle>Delete Event</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">Are you sure you want to delete this event?</p>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteEvent.mutate({ id: deleteConfirm })}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
