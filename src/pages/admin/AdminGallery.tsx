import { useState } from "react";
import { Upload, Trash2, Star, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useGalleryImages, useCreateGalleryImage, useUpdateGalleryImage, useDeleteGalleryImage } from "@/lib/supabase-hooks";
import { BulkActionBar } from "@/components/admin/BulkActionBar";

const CATEGORIES = ["General", "Food & Drinks", "Ambience", "Outdoor Seating", "Night Vibes", "Events", "Bar Area"];

export default function AdminGallery() {
  const [uploadDialog, setUploadDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("General");
  const [altText, setAltText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: images, isLoading } = useGalleryImages({});
  const createImage = useCreateGalleryImage();
  const updateImage = useUpdateGalleryImage();
  const deleteImage = useDeleteGalleryImage();

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const clear = () => setSelected(new Set());
  const selectAll = () => setSelected(new Set((images ?? []).map((i) => i.id)));

  const uploadSingle = () => {
    if (!imageUrl) return toast.error("Image URL is required");
    createImage.mutate({ image_url: imageUrl, category, alt_text: altText || undefined }, {
      onSuccess: () => { setUploadDialog(false); setImageUrl(""); setAltText(""); toast.success("Image added"); },
      onError: (e) => toast.error(e.message),
    });
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    const results = await Promise.allSettled(ids.map((id) => deleteImage.mutateAsync(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed) toast.error(`${failed} of ${ids.length} failed to delete`);
    else toast.success(`Deleted ${ids.length} image${ids.length > 1 ? "s" : ""}`);
    clear();
    setBulkDeleteConfirm(false);
  };

  const bulkToggleFeatured = async (value: boolean) => {
    const ids = Array.from(selected);
    await Promise.allSettled(ids.map((id) => updateImage.mutateAsync({ id, is_featured: value })));
    toast.success(`${value ? "Featured" : "Unfeatured"} ${ids.length} image${ids.length > 1 ? "s" : ""}`);
    clear();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gallery</h1>
          <p className="text-muted-foreground text-sm mt-1">Upload and manage gallery images</p>
        </div>
        <div className="flex gap-2">
          {images && images.length > 0 && (
            <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-accent" onClick={selected.size === images.length ? clear : selectAll}>
              <CheckSquare className="w-4 h-4 mr-1" /> {selected.size === images.length ? "Deselect" : "Select all"}
            </Button>
          )}
          <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setImageUrl(""); setAltText(""); setUploadDialog(true); }}>
            <Upload className="w-4 h-4 mr-1" /> Add Image
          </Button>
        </div>
      </div>

      <BulkActionBar count={selected.size} onClear={clear}>
        <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-accent" onClick={() => bulkToggleFeatured(true)}>
          <Star className="w-4 h-4 mr-1" /> Feature
        </Button>
        <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-accent" onClick={() => bulkToggleFeatured(false)}>
          Unfeature
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setBulkDeleteConfirm(true)}>
          <Trash2 className="w-4 h-4 mr-1" /> Delete
        </Button>
      </BulkActionBar>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : images && images.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {images.map((img) => {
            const isSelected = selected.has(img.id);
            return (
              <div key={img.id} className={`relative group rounded-xl overflow-hidden aspect-square bg-muted ${isSelected ? "ring-2 ring-primary" : ""}`}>
                <img src={img.image_url} alt={img.alt_text ?? "Gallery"} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute top-2 left-2 z-10">
                  <Checkbox checked={isSelected} onCheckedChange={() => toggle(img.id)} className="bg-background/80 border-border" />
                </div>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                  <Badge className="text-xs bg-background/80 text-foreground border-border">{img.category}</Badge>
                  <div className="flex gap-2">
                    <button onClick={() => updateImage.mutate({ id: img.id, is_featured: !img.is_featured })} className={`p-1.5 rounded-full ${img.is_featured ? "bg-primary text-primary-foreground" : "bg-white/20 text-white"}`}>
                      <Star className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteConfirm(img.id)} className="p-1.5 rounded-full bg-red-500/80 text-white hover:bg-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {img.is_featured && <div className="absolute top-2 right-2"><Star className="w-4 h-4 fill-primary text-primary" /></div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No images yet. Add your first gallery image.</p>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
          <DialogHeader><DialogTitle>Add Gallery Image</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-foreground">Image URL *</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="bg-input border-border text-foreground mt-1" placeholder="https://..." />
            </div>
            <div>
              <Label className="text-foreground">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-input border-border text-foreground mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-foreground">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground">Alt Text</Label>
              <Input value={altText} onChange={(e) => setAltText(e.target.value)} className="bg-input border-border text-foreground mt-1" placeholder="Describe the image..." />
            </div>
            {imageUrl && <img src={imageUrl} alt="preview" className="w-full h-40 object-cover rounded-lg" onError={(e) => (e.currentTarget.style.display = "none")} />}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setUploadDialog(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" onClick={uploadSingle} disabled={createImage.isPending}>
              {createImage.isPending ? "Adding..." : "Add Image"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader><DialogTitle>Delete Image</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">Are you sure you want to delete this image?</p>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteImage.mutate(deleteConfirm, { onSuccess: () => { setDeleteConfirm(null); toast.success("Image deleted"); } })}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirm */}
      <Dialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader><DialogTitle>Delete {selected.size} images?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setBulkDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={bulkDelete}>Delete all</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
