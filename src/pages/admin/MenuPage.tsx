import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function MenuPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [catForm, setCatForm] = useState({ id: "", name: "", description: "", sort_order: 0 });
  const [itemForm, setItemForm] = useState({ id: "", name: "", description: "", price: 0, category_id: "", sort_order: 0, is_featured: false });
  const { toast } = useToast();

  const fetchData = async () => {
    const [catRes, itemRes] = await Promise.all([
      supabase.from("menu_categories").select("*").order("sort_order"),
      supabase.from("menu_items").select("*").order("sort_order"),
    ]);
    setCategories(catRes.data || []);
    setItems(itemRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Category CRUD
  const saveCat = async () => {
    if (editingCat) {
      const { error } = await supabase.from("menu_categories").update({ name: catForm.name, description: catForm.description, sort_order: catForm.sort_order }).eq("id", editingCat.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const id = catForm.id || catForm.name.toLowerCase().replace(/\s+/g, "-");
      const { error } = await supabase.from("menu_categories").insert({ id, name: catForm.name, description: catForm.description, sort_order: catForm.sort_order });
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: editingCat ? "Category updated" : "Category created" });
    setCatDialogOpen(false);
    setEditingCat(null);
    setCatForm({ id: "", name: "", description: "", sort_order: 0 });
    fetchData();
  };

  const deleteCat = async (id: string) => {
    if (!confirm("Delete category and all its items?")) return;
    await supabase.from("menu_items").delete().eq("category_id", id);
    await supabase.from("menu_categories").delete().eq("id", id);
    toast({ title: "Category deleted" });
    fetchData();
  };

  // Item CRUD
  const saveItem = async () => {
    if (editingItem) {
      const { error } = await supabase.from("menu_items").update({
        name: itemForm.name, description: itemForm.description, price: itemForm.price,
        category_id: itemForm.category_id, sort_order: itemForm.sort_order, is_featured: itemForm.is_featured,
      }).eq("id", editingItem.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const id = itemForm.id || itemForm.name.toLowerCase().replace(/\s+/g, "-");
      const { error } = await supabase.from("menu_items").insert({
        id, name: itemForm.name, description: itemForm.description, price: itemForm.price,
        category_id: itemForm.category_id, sort_order: itemForm.sort_order, is_featured: itemForm.is_featured,
      });
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: editingItem ? "Item updated" : "Item created" });
    setItemDialogOpen(false);
    setEditingItem(null);
    setItemForm({ id: "", name: "", description: "", price: 0, category_id: "", sort_order: 0, is_featured: false });
    fetchData();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await supabase.from("menu_items").delete().eq("id", id);
    toast({ title: "Item deleted" });
    fetchData();
  };

  const getCategoryName = (catId: string) => categories.find(c => c.id === catId)?.name || catId;

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Menu Manager</h1>
      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <Tabs defaultValue="items">
          <TabsList>
            <TabsTrigger value="items">Items ({items.length})</TabsTrigger>
            <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="mt-4">
            <div className="flex justify-end mb-4">
              <Dialog open={itemDialogOpen} onOpenChange={(o) => { setItemDialogOpen(o); if (!o) { setEditingItem(null); setItemForm({ id: "", name: "", description: "", price: 0, category_id: categories[0]?.id || "", sort_order: 0, is_featured: false }); } }}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-fire"><Plus size={16} className="mr-2" />Add Item</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editingItem ? "Edit Item" : "New Item"}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    {!editingItem && (
                      <div className="space-y-2"><Label>ID (slug)</Label><Input value={itemForm.id} onChange={(e) => setItemForm({ ...itemForm, id: e.target.value })} placeholder="auto-generated" /></div>
                    )}
                    <div className="space-y-2"><Label>Name</Label><Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Description</Label><Textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Price (KES)</Label><Input type="number" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: Number(e.target.value) })} /></div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={itemForm.category_id} onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Sort Order</Label><Input type="number" value={itemForm.sort_order} onChange={(e) => setItemForm({ ...itemForm, sort_order: Number(e.target.value) })} /></div>
                      <div className="flex items-center gap-2 pt-6">
                        <input type="checkbox" checked={itemForm.is_featured} onChange={(e) => setItemForm({ ...itemForm, is_featured: e.target.checked })} />
                        <Label>Featured</Label>
                      </div>
                    </div>
                    <Button onClick={saveItem} className="w-full">{editingItem ? "Update" : "Create"}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Featured</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{getCategoryName(item.category_id)}</TableCell>
                      <TableCell>KES {item.price}</TableCell>
                      <TableCell>{item.is_featured ? "⭐" : "—"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingItem(item); setItemForm({ id: item.id, name: item.name, description: item.description || "", price: item.price, category_id: item.category_id, sort_order: item.sort_order, is_featured: item.is_featured }); setItemDialogOpen(true); }}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteItem(item.id)} className="text-destructive"><Trash2 size={14} /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No items yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="mt-4">
            <div className="flex justify-end mb-4">
              <Dialog open={catDialogOpen} onOpenChange={(o) => { setCatDialogOpen(o); if (!o) { setEditingCat(null); setCatForm({ id: "", name: "", description: "", sort_order: 0 }); } }}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-fire"><Plus size={16} className="mr-2" />Add Category</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editingCat ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    {!editingCat && <div className="space-y-2"><Label>ID (slug)</Label><Input value={catForm.id} onChange={(e) => setCatForm({ ...catForm, id: e.target.value })} placeholder="auto-generated" /></div>}
                    <div className="space-y-2"><Label>Name</Label><Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Description</Label><Textarea value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Sort Order</Label><Input type="number" value={catForm.sort_order} onChange={(e) => setCatForm({ ...catForm, sort_order: Number(e.target.value) })} /></div>
                    <Button onClick={saveCat} className="w-full">{editingCat ? "Update" : "Create"}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.id}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.sort_order}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingCat(c); setCatForm({ id: c.id, name: c.name, description: c.description || "", sort_order: c.sort_order }); setCatDialogOpen(true); }}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteCat(c.id)} className="text-destructive"><Trash2 size={14} /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {categories.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No categories yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </AdminLayout>
  );
}
