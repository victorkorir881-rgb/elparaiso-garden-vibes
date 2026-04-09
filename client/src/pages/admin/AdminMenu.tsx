import { useState, useRef } from "react";
import { Plus, Pencil, Trash2, Star, Eye, EyeOff, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const FOOD_PLACEHOLDER = "https://images.unsplash.com/photo-1544025162-d76694265947?w=200&q=60";

type ItemForm = {
  id?: number; categoryId: number; name: string; description: string; price: string;
  badge: string; isAvailable: boolean; isFeatured: boolean; imageBase64?: string; imageMime?: string; imagePreview?: string;
};

const defaultItemForm = (): ItemForm => ({
  categoryId: 0, name: "", description: "", price: "", badge: "", isAvailable: true, isFeatured: false,
});

export default function AdminMenu() {
  const [search, setSearch] = useState("");
  const [activeCatId, setActiveCatId] = useState<number | null>(null);
  const [itemDialog, setItemDialog] = useState(false);
  const [catDialog, setCatDialog] = useState(false);
  const [editItem, setEditItem] = useState<ItemForm>(defaultItemForm());
  const [editCat, setEditCat] = useState({ id: 0, name: "", slug: "", description: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "item" | "cat"; id: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: categories } = trpc.menuCategories.list.useQuery({ activeOnly: false });
  const { data: items } = trpc.menuItems.list.useQuery({ categoryId: activeCatId ?? undefined, search: search || undefined });

  const createItem = trpc.menuItems.create.useMutation({ onSuccess: () => { utils.menuItems.list.invalidate(); setItemDialog(false); toast.success("Item created"); } });
  const updateItem = trpc.menuItems.update.useMutation({ onSuccess: () => { utils.menuItems.list.invalidate(); setItemDialog(false); toast.success("Item updated"); } });
  const deleteItem = trpc.menuItems.delete.useMutation({ onSuccess: () => { utils.menuItems.list.invalidate(); setDeleteConfirm(null); toast.success("Item deleted"); } });
  const toggleFeatured = trpc.menuItems.toggleFeatured.useMutation({ onSuccess: () => utils.menuItems.list.invalidate() });
  const toggleAvail = trpc.menuItems.toggleAvailability.useMutation({ onSuccess: () => utils.menuItems.list.invalidate() });

  const createCat = trpc.menuCategories.create.useMutation({ onSuccess: () => { utils.menuCategories.list.invalidate(); setCatDialog(false); toast.success("Category created"); } });
  const updateCat = trpc.menuCategories.update.useMutation({ onSuccess: () => { utils.menuCategories.list.invalidate(); setCatDialog(false); toast.success("Category updated"); } });
  const deleteCat = trpc.menuCategories.delete.useMutation({ onSuccess: () => { utils.menuCategories.list.invalidate(); setDeleteConfirm(null); toast.success("Category deleted"); } });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setEditItem((prev) => ({ ...prev, imageBase64: ev.target?.result as string, imageMime: file.type, imagePreview: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const saveItem = () => {
    if (!editItem.name || !editItem.price || !editItem.categoryId) return toast.error("Name, price, and category are required");
    const payload = {
      categoryId: editItem.categoryId, name: editItem.name, description: editItem.description || undefined,
      price: editItem.price, badge: editItem.badge || undefined, isAvailable: editItem.isAvailable,
      isFeatured: editItem.isFeatured, imageBase64: editItem.imageBase64, imageMime: editItem.imageMime,
    };
    if (editItem.id) updateItem.mutate({ id: editItem.id, ...payload });
    else createItem.mutate(payload);
  };

  const saveCat = () => {
    if (!editCat.name) return toast.error("Name is required");
    const slug = editCat.slug || editCat.name.toLowerCase().replace(/\s+/g, "-");
    if (editCat.id) updateCat.mutate({ id: editCat.id, name: editCat.name, slug, description: editCat.description || undefined });
    else createCat.mutate({ name: editCat.name, slug, description: editCat.description || undefined });
  };

  const openNewItem = () => {
    setEditItem({ ...defaultItemForm(), categoryId: activeCatId ?? (categories?.[0]?.id ?? 0) });
    setItemDialog(true);
  };

  const openEditItem = (item: any) => {
    setEditItem({ id: item.id, categoryId: item.categoryId, name: item.name, description: item.description ?? "", price: String(item.price), badge: item.badge ?? "", isAvailable: item.isAvailable, isFeatured: item.isFeatured });
    setItemDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Menu Manager</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage categories and menu items</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-accent" onClick={() => { setEditCat({ id: 0, name: "", slug: "", description: "" }); setCatDialog(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Category
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground" onClick={openNewItem}>
            <Plus className="w-4 h-4 mr-1" /> Add Item
          </Button>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="font-semibold text-foreground mb-3 text-sm">Categories</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveCatId(null)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeCatId === null ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground hover:text-foreground"}`}>
            All
          </button>
          {categories?.map((cat) => (
            <div key={cat.id} className="flex items-center gap-1">
              <button onClick={() => setActiveCatId(cat.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeCatId === cat.id ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground hover:text-foreground"}`}>
                {cat.name}
              </button>
              <button onClick={() => { setEditCat({ id: cat.id, name: cat.name, slug: cat.slug, description: cat.description ?? "" }); setCatDialog(true); }} className="text-muted-foreground hover:text-primary p-1">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={() => setDeleteConfirm({ type: "cat", id: cat.id })} className="text-muted-foreground hover:text-destructive p-1">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground" />
      </div>

      {/* Items Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Item</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Price</th>
                <th className="text-center px-4 py-3 text-muted-foreground font-medium">Available</th>
                <th className="text-center px-4 py-3 text-muted-foreground font-medium">Featured</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items?.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={item.imageUrl ?? FOOD_PLACEHOLDER} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                      <div>
                        <div className="font-medium text-foreground">{item.name}</div>
                        {item.badge && <Badge className="text-xs bg-primary/20 text-primary border-primary/30 mt-0.5">{item.badge}</Badge>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {categories?.find((c) => c.id === item.categoryId)?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-primary font-semibold">KES {Number(item.price).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <Switch checked={item.isAvailable} onCheckedChange={(v) => toggleAvail.mutate({ id: item.id, isAvailable: v })} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleFeatured.mutate({ id: item.id, isFeatured: !item.isFeatured })}>
                      <Star className={`w-4 h-4 mx-auto ${item.isFeatured ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEditItem(item)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteConfirm({ type: "item", id: item.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!items || items.length === 0) && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No items found. Add your first menu item.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Item Dialog */}
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem.id ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-foreground">Category *</Label>
              <Select value={String(editItem.categoryId)} onValueChange={(v) => setEditItem((p) => ({ ...p, categoryId: Number(v) }))}>
                <SelectTrigger className="bg-input border-border text-foreground mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {categories?.map((c) => <SelectItem key={c.id} value={String(c.id)} className="text-foreground">{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-foreground">Name *</Label>
                <Input value={editItem.name} onChange={(e) => setEditItem((p) => ({ ...p, name: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="Item name" />
              </div>
              <div>
                <Label className="text-foreground">Price (KES) *</Label>
                <Input value={editItem.price} onChange={(e) => setEditItem((p) => ({ ...p, price: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="e.g. 450" type="number" />
              </div>
            </div>
            <div>
              <Label className="text-foreground">Description</Label>
              <Textarea value={editItem.description} onChange={(e) => setEditItem((p) => ({ ...p, description: e.target.value }))} className="bg-input border-border text-foreground mt-1 resize-none" rows={2} placeholder="Brief description..." />
            </div>
            <div>
              <Label className="text-foreground">Badge (optional)</Label>
              <Input value={editItem.badge} onChange={(e) => setEditItem((p) => ({ ...p, badge: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="e.g. New, Popular, Chef's Pick" />
            </div>
            <div>
              <Label className="text-foreground">Image</Label>
              <div className="mt-1 flex items-center gap-3">
                {editItem.imagePreview && <img src={editItem.imagePreview} alt="preview" className="w-16 h-16 rounded-lg object-cover" />}
                <Button type="button" variant="outline" size="sm" className="border-border text-foreground hover:bg-accent" onClick={() => fileRef.current?.click()}>
                  {editItem.imagePreview ? "Change Image" : "Upload Image"}
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={editItem.isAvailable} onCheckedChange={(v) => setEditItem((p) => ({ ...p, isAvailable: v }))} />
                <Label className="text-foreground">Available</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editItem.isFeatured} onCheckedChange={(v) => setEditItem((p) => ({ ...p, isFeatured: v }))} />
                <Label className="text-foreground">Featured</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setItemDialog(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" onClick={saveItem} disabled={createItem.isPending || updateItem.isPending}>
              {createItem.isPending || updateItem.isPending ? "Saving..." : "Save Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader><DialogTitle>{editCat.id ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-foreground">Name *</Label>
              <Input value={editCat.name} onChange={(e) => setEditCat((p) => ({ ...p, name: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="Category name" />
            </div>
            <div>
              <Label className="text-foreground">Slug (auto-generated if empty)</Label>
              <Input value={editCat.slug} onChange={(e) => setEditCat((p) => ({ ...p, slug: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="e.g. grills-and-platters" />
            </div>
            <div>
              <Label className="text-foreground">Description</Label>
              <Textarea value={editCat.description} onChange={(e) => setEditCat((p) => ({ ...p, description: e.target.value }))} className="bg-input border-border text-foreground mt-1 resize-none" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setCatDialog(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" onClick={saveCat} disabled={createCat.isPending || updateCat.isPending}>
              {createCat.isPending || updateCat.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">Are you sure you want to delete this {deleteConfirm?.type === "cat" ? "category" : "item"}? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (!deleteConfirm) return;
              if (deleteConfirm.type === "item") deleteItem.mutate({ id: deleteConfirm.id });
              else deleteCat.mutate({ id: deleteConfirm.id });
            }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
