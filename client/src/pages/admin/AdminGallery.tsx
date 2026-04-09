import { useState, useRef } from "react";
import { Upload, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const CATEGORIES = ["General", "Food & Drinks", "Ambience", "Outdoor Seating", "Night Vibes", "Events", "Bar Area"];

export default function AdminGallery() {
  const [uploadDialog, setUploadDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [uploads, setUploads] = useState<{ base64: string; mime: string; preview: string; category: string; altText: string; isFeatured: boolean }[]>([]);
  const [category, setCategory] = useState("General");
  const fileRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: images, isLoading } = trpc.gallery.list.useQuery({});
  const uploadMutation = trpc.gallery.upload.useMutation({
    onSuccess: () => { utils.gallery.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const updateImage = trpc.gallery.update.useMutation({ onSuccess: () => utils.gallery.list.invalidate() });
  const deleteImage = trpc.gallery.delete.useMutation({ onSuccess: () => { utils.gallery.list.invalidate(); setDeleteConfirm(null); toast.success("Image deleted"); } });

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploads((prev) => [...prev, { base64: ev.target?.result as string, mime: file.type, preview: ev.target?.result as string, category, altText: "", isFeatured: false }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadAll = async () => {
    if (uploads.length === 0) return;
    let success = 0;
    for (const u of uploads) {
      try {
        await uploadMutation.mutateAsync({ imageBase64: u.base64, imageMime: u.mime, category: u.category, altText: u.altText || undefined, isFeatured: u.isFeatured });
        success++;
      } catch {}
    }
    toast.success(`${success} image${success !== 1 ? "s" : ""} uploaded`);
    setUploads([]);
    setUploadDialog(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gallery</h1>
          <p className="text-muted-foreground text-sm mt-1">Upload and manage gallery images</p>
        </div>
        <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => { setUploads([]); setUploadDialog(true); }}>
          <Upload className="w-4 h-4 mr-1" /> Upload Images
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : images && images.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {images.map((img) => (
            <div key={img.id} className="relative group rounded-xl overflow-hidden aspect-square bg-muted">
              <img src={img.imageUrl} alt={img.altText ?? "Gallery"} className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                <Badge className="text-xs bg-background/80 text-foreground border-border">{img.category}</Badge>
                <div className="flex gap-2">
                  <button onClick={() => updateImage.mutate({ id: img.id, isFeatured: !img.isFeatured })} className={`p-1.5 rounded-full ${img.isFeatured ? "bg-primary text-primary-foreground" : "bg-white/20 text-white"}`}>
                    <Star className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteConfirm(img.id)} className="p-1.5 rounded-full bg-red-500/80 text-white hover:bg-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {img.isFeatured && <div className="absolute top-2 right-2"><Star className="w-4 h-4 fill-primary text-primary" /></div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No images yet. Upload your first gallery image.</p>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Upload Gallery Images</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-foreground">Default Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-input border-border text-foreground mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-foreground">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Click to select images (multiple allowed)</p>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
            </div>
            {uploads.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {uploads.map((u, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden aspect-square">
                    <img src={u.preview} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setUploads((p) => p.filter((_, j) => j !== i))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setUploadDialog(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" onClick={uploadAll} disabled={uploads.length === 0 || uploadMutation.isPending}>
              {uploadMutation.isPending ? "Uploading..." : `Upload ${uploads.length} Image${uploads.length !== 1 ? "s" : ""}`}
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
            <Button variant="destructive" onClick={() => deleteConfirm && deleteImage.mutate({ id: deleteConfirm })}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
