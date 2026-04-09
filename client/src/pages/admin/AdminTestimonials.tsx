import { useState } from "react";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type TestimonialForm = { id?: number; reviewerName: string; sourceLabel: string; reviewText: string; rating: number; isFeatured: boolean; };
const defaultForm = (): TestimonialForm => ({ reviewerName: "", sourceLabel: "Google", reviewText: "", rating: 5, isFeatured: true });

export default function AdminTestimonials() {
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState<TestimonialForm>(defaultForm());
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: testimonials, isLoading } = trpc.testimonials.list.useQuery({ featuredOnly: false });
  const create = trpc.testimonials.create.useMutation({ onSuccess: () => { utils.testimonials.list.invalidate(); setDialog(false); toast.success("Testimonial added"); } });
  const update = trpc.testimonials.update.useMutation({ onSuccess: () => { utils.testimonials.list.invalidate(); setDialog(false); toast.success("Testimonial updated"); } });
  const del = trpc.testimonials.delete.useMutation({ onSuccess: () => { utils.testimonials.list.invalidate(); setDeleteConfirm(null); toast.success("Deleted"); } });

  const save = () => {
    if (!form.reviewerName || !form.reviewText) return toast.error("Name and review are required");
    const payload = { reviewerName: form.reviewerName, sourceLabel: form.sourceLabel || undefined, reviewText: form.reviewText, rating: form.rating, isFeatured: form.isFeatured };
    if (form.id) update.mutate({ id: form.id, ...payload });
    else create.mutate(payload);
  };

  const openEdit = (t: any) => {
    setForm({ id: t.id, reviewerName: t.reviewerName, sourceLabel: t.sourceLabel ?? "Google", reviewText: t.reviewText, rating: t.rating, isFeatured: t.isFeatured });
    setDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Testimonials</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage customer reviews and testimonials</p>
        </div>
        <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setForm(defaultForm()); setDialog(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Testimonial
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Customer</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Review</th>
              <th className="text-center px-4 py-3 text-muted-foreground font-medium">Rating</th>
              <th className="text-center px-4 py-3 text-muted-foreground font-medium">Featured</th>
              <th className="text-right px-4 py-3 text-muted-foreground font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Loading...</td></tr>
            ) : testimonials && testimonials.length > 0 ? (
              testimonials.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-accent/20">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{t.reviewerName}</div>
                    {t.sourceLabel && <div className="text-xs text-muted-foreground">{t.sourceLabel}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs">
                    <p className="truncate">{t.reviewText}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < t.rating ? "fill-primary text-primary" : "text-muted"}`} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch checked={t.isFeatured} onCheckedChange={(v) => update.mutate({ id: t.id, isFeatured: v })} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteConfirm(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No testimonials yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader><DialogTitle>{form.id ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground">Customer Name *</Label>
                <Input value={form.reviewerName} onChange={(e) => setForm((p) => ({ ...p, reviewerName: e.target.value }))} className="bg-input border-border text-foreground mt-1" />
              </div>
              <div>
                <Label className="text-foreground">Source</Label>
                <Input value={form.sourceLabel} onChange={(e) => setForm((p) => ({ ...p, sourceLabel: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="e.g. Google, TripAdvisor" />
              </div>
            </div>
            <div>
              <Label className="text-foreground">Review *</Label>
              <Textarea value={form.reviewText} onChange={(e) => setForm((p) => ({ ...p, reviewText: e.target.value }))} className="bg-input border-border text-foreground mt-1 resize-none" rows={3} />
            </div>
            <div>
              <Label className="text-foreground">Rating</Label>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setForm((p) => ({ ...p, rating: n }))}>
                    <Star className={`w-6 h-6 ${n <= form.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isFeatured} onCheckedChange={(v) => setForm((p) => ({ ...p, isFeatured: v }))} />
              <Label className="text-foreground">Featured (show on homepage)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setDialog(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" onClick={save} disabled={create.isPending || update.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader><DialogTitle>Delete Testimonial</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">Are you sure?</p>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && del.mutate({ id: deleteConfirm })}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
