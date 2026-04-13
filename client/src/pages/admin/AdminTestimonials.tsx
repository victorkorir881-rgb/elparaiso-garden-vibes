import { useState } from "react";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useReviews, useCreateReview, useUpdateReview, useDeleteReview } from "@/lib/supabase-hooks";

type TestimonialForm = { id?: string; authorName: string; source: string; comment: string; rating: number; isFeatured: boolean; };
const defaultForm = (): TestimonialForm => ({ authorName: "", source: "Google", comment: "", rating: 5, isFeatured: true });

export default function AdminTestimonials() {
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState<TestimonialForm>(defaultForm());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: testimonials, isLoading } = useReviews(false);
  const create = useCreateReview();
  const update = useUpdateReview();
  const del = useDeleteReview();

  const save = () => {
    if (!form.authorName || !form.comment) return toast.error("Name and review are required");
    const payload = { author_name: form.authorName, source: form.source || undefined, comment: form.comment, rating: form.rating, is_featured: form.isFeatured, is_approved: true };
    if (form.id) {
      update.mutate({ id: form.id, ...payload }, { onSuccess: () => { setDialog(false); toast.success("Testimonial updated"); } });
    } else {
      create.mutate(payload, { onSuccess: () => { setDialog(false); toast.success("Testimonial added"); } });
    }
  };

  const openEdit = (t: any) => {
    setForm({ id: t.id, authorName: t.author_name, source: t.source ?? "Google", comment: t.comment ?? "", rating: t.rating, isFeatured: t.is_featured });
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
                    <div className="font-medium text-foreground">{t.author_name}</div>
                    {t.source && <div className="text-xs text-muted-foreground">{t.source}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs">
                    <p className="truncate">{t.comment}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < t.rating ? "fill-primary text-primary" : "text-muted"}`} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch checked={t.is_featured} onCheckedChange={(v) => update.mutate({ id: t.id, is_featured: v })} />
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
                <Input value={form.authorName} onChange={(e) => setForm((p) => ({ ...p, authorName: e.target.value }))} className="bg-input border-border text-foreground mt-1" />
              </div>
              <div>
                <Label className="text-foreground">Source</Label>
                <Input value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="e.g. Google, TripAdvisor" />
              </div>
            </div>
            <div>
              <Label className="text-foreground">Review *</Label>
              <Textarea value={form.comment} onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))} className="bg-input border-border text-foreground mt-1 resize-none" rows={3} />
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
            <Button variant="destructive" onClick={() => deleteConfirm && del.mutate(deleteConfirm, { onSuccess: () => { setDeleteConfirm(null); toast.success("Deleted"); } })}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
