import { useState } from "react";
import { Plus, Pencil, Trash2, Star, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BulkActionBar } from "@/components/admin/BulkActionBar";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { toast } from "sonner";
import {
  useMenuCategories, useMenuItems,
  useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem,
  useCreateMenuCategory, useUpdateMenuCategory, useDeleteMenuCategory,
} from "@/lib/supabase-hooks";

const FOOD_PLACEHOLDER = "https://images.unsplash.com/photo-1544025162-d76694265947?w=200&q=60";

type ItemForm = {
  id?: string; categoryId: string; name: string; description: string; price: string;
  isAvailable: boolean; isFeatured: boolean; imageUrl?: string;
};

const defaultItemForm = (): ItemForm => ({
  categoryId: "", name: "", description: "", price: "", isAvailable: true, isFeatured: false,
});

export default function AdminMenu() {
  const [search, setSearch] = useState("");
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [itemDialog, setItemDialog] = useState(false);
  const [catDialog, setCatDialog] = useState(false);
  const [editItem, setEditItem] = useState<ItemForm>(defaultItemForm());
  const [editCat, setEditCat] = useState({ id: "", name: "", description: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "item" | "cat"; id: string } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const { data: categories } = useMenuCategories(false);
  const { data: items } = useMenuItems({ categoryId: activeCatId ?? undefined, search: search || undefined });

  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();

  const createCat = useCreateMenuCategory();
  const updateCat = useUpdateMenuCategory();
  const deleteCat = useDeleteMenuCategory();

  const saveItem = () => {
    if (!editItem.name || !editItem.price || !editItem.categoryId) return toast.error("Name, price, and category are required");
    const payload = {
      category_id: editItem.categoryId, name: editItem.name, description: editItem.description || undefined,
      price: parseFloat(editItem.price), is_available: editItem.isAvailable,
      is_featured: editItem.isFeatured, image_url: editItem.imageUrl,
    };
    if (editItem.id) {
      updateItem.mutate({ id: editItem.id, ...payload }, { onSuccess: () => { setItemDialog(false); toast.success("Item updated"); } });
    } else {
      const id = editItem.name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
      createItem.mutate({ id, ...payload }, { onSuccess: () => { setItemDialog(false); toast.success("Item created"); } });
    }
  };

  const saveCat = () => {
    if (!editCat.name) return toast.error("Name is required");
    const id = editCat.id || editCat.name.toLowerCase().replace(/\s+/g, "-");
    if (editCat.id) {
      updateCat.mutate({ id: editCat.id, name: editCat.name, description: editCat.description || undefined }, { onSuccess: () => { setCatDialog(false); toast.success("Category updated"); } });
    } else {
      createCat.mutate({ id, name: editCat.name, description: editCat.description || undefined }, { onSuccess: () => { setCatDialog(false); toast.success("Category created"); } });
    }
  };

  const openNewItem = () => {
    setEditItem({ ...defaultItemForm(), categoryId: activeCatId ?? (categories?.[0]?.id ?? "") });
    setItemDialog(true);
  };

  const openEditItem = (item: any) => {
    setEditItem({ id: item.id, categoryId: item.category_id, name: item.name, description: item.description ?? "", price: String(item.price), isAvailable: item.is_available, isFeatured: item.is_featured, imageUrl: item.image_url });
    setItemDialog(true);
  };

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const clearPicked = () => setPicked(new Set());
  const allPicked = !!items && items.length > 0 && items.every((i) => picked.has(i.id));
  const togglePickAll = () => setPicked(allPicked ? new Set() : new Set((items ?? []).map((i) => i.id)));

  const bulkSetAvailability = async (value: boolean) => {
    const ids = Array.from(picked);
    await Promise.allSettled(ids.map((id) => updateItem.mutateAsync({ id, is_available: value })));
    toast.success(`${value ? "Enabled" : "Disabled"} ${ids.length} item${ids.length > 1 ? "s" : ""}`);
    clearPicked();
  };
  const bulkDelete = async () => {
    const ids = Array.from(picked);
    const results = await Promise.allSettled(ids.map((id) => deleteItem.mutateAsync(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed) toast.error(`${failed} of ${ids.length} failed to delete`);
    else toast.success(`Deleted ${ids.length} item${ids.length > 1 ? "s" : ""}`);
    clearPicked();
    setBulkDeleteConfirm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Menu Manager</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage categories and menu items</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-accent" onClick={() => { setEditCat({ id: "", name: "", description: "" }); setCatDialog(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Category
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground" onClick={openNewItem}>
            <Plus className="w-4 h-4 mr-1" /> Add Item
          </Button>
        </div>
      </div>

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
              <button onClick={() => { setEditCat({ id: cat.id, name: cat.name, description: cat.description ?? "" }); setCatDialog(true); }} className="text-muted-foreground hover:text-primary p-1">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={() => setDeleteConfirm({ type: "cat", id: cat.id })} className="text-muted-foreground hover:text-destructive p-1">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground" />
      </div>

      <BulkActionBar count={picked.size} onClear={clearPicked}>
        <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-accent" onClick={() => bulkSetAvailability(true)}>
          Make available
        </Button>
        <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-accent" onClick={() => bulkSetAvailability(false)}>
          Make unavailable
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setBulkDeleteConfirm(true)}>
          <Trash2 className="w-4 h-4 mr-1" /> Delete
        </Button>
      </BulkActionBar>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 w-8">
                  <Checkbox checked={!!allPicked} onCheckedChange={togglePickAll} aria-label="Select all" />
                </th>
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
                <tr key={item.id} className={`border-b border-border last:border-0 hover:bg-accent/30 transition-colors ${picked.has(item.id) ? "bg-primary/5" : ""}`}>
                  <td className="px-4 py-3">
                    <Checkbox checked={picked.has(item.id)} onCheckedChange={() => togglePick(item.id)} aria-label={`Select ${item.name}`} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={item.image_url ?? FOOD_PLACEHOLDER} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                      <div>
                        <div className="font-medium text-foreground">{item.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {categories?.find((c) => c.id === item.category_id)?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-primary font-semibold">KES {Number(item.price).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <Switch checked={item.is_available} onCheckedChange={(v) => updateItem.mutate({ id: item.id, is_available: v })} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => updateItem.mutate({ id: item.id, is_featured: !item.is_featured })}>
                      <Star className={`w-4 h-4 mx-auto ${item.is_featured ? "fill-primary text-primary" : "text-muted-foreground"}`} />
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
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No items found. Add your first menu item.</td></tr>
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
              <Select value={editItem.categoryId} onValueChange={(v) => setEditItem((p) => ({ ...p, categoryId: v }))}>
                <SelectTrigger className="bg-input border-border text-foreground mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {categories?.map((c) => <SelectItem key={c.id} value={c.id} className="text-foreground">{c.name}</SelectItem>)}
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
            <ImageUploadField
              value={editItem.imageUrl ?? ""}
              onChange={(url) => setEditItem((p) => ({ ...p, imageUrl: url }))}
              folder="menu"
              label="Image"
            />
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
              if (deleteConfirm.type === "item") deleteItem.mutate(deleteConfirm.id, { onSuccess: () => { setDeleteConfirm(null); toast.success("Item deleted"); } });
              else deleteCat.mutate(deleteConfirm.id, { onSuccess: () => { setDeleteConfirm(null); toast.success("Category deleted"); } });
            }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader><DialogTitle>Delete {picked.size} items?</DialogTitle></DialogHeader>
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
