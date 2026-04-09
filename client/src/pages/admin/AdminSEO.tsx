import { useState, useEffect } from "react";
import { Save, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const PAGES = [
  { value: "home", label: "Home Page" },
  { value: "menu", label: "Menu Page" },
  { value: "about", label: "About Page" },
  { value: "gallery", label: "Gallery Page" },
  { value: "contact", label: "Contact Page" },
  { value: "reservations", label: "Reservations Page" },
  { value: "events", label: "Events Page" },
];

type SeoForm = { title: string; description: string; keywords: string; ogTitle: string; ogDescription: string; ogImage: string; };
const defaultForm = (): SeoForm => ({ title: "", description: "", keywords: "", ogTitle: "", ogDescription: "", ogImage: "" });

export default function AdminSEO() {
  const [page, setPage] = useState("home");
  const [form, setForm] = useState<SeoForm>(defaultForm());

  const { data: seoData } = trpc.seo.getByPage.useQuery({ page });
  const update = trpc.seo.update.useMutation({ onSuccess: () => toast.success("SEO settings saved") });

  useEffect(() => {
    if (seoData) {
      setForm({
        title: seoData.seoTitle ?? "",
        description: seoData.metaDescription ?? "",
        keywords: "",
        ogTitle: seoData.ogTitle ?? "",
        ogDescription: seoData.ogDescription ?? "",
        ogImage: seoData.ogImage ?? "",
      });
    } else {
      setForm(defaultForm());
    }
  }, [seoData, page]);

  const save = () => update.mutate({ page, ...form });

  const titleLen = form.title.length;
  const descLen = form.description.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SEO Manager</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage per-page metadata and Open Graph tags</p>
        </div>
        <Button className="bg-primary text-primary-foreground" onClick={save} disabled={update.isPending}>
          <Save className="w-4 h-4 mr-1" /> {update.isPending ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Page Selector */}
      <div className="bg-card border border-border rounded-xl p-4">
        <Label className="text-foreground mb-2 block">Select Page</Label>
        <Select value={page} onValueChange={setPage}>
          <SelectTrigger className="bg-input border-border text-foreground w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {PAGES.map((p) => <SelectItem key={p.value} value={p.value} className="text-foreground">{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Meta Tags */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> Meta Tags
          </h2>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-foreground">Title</Label>
              <span className={`text-xs ${titleLen > 60 ? "text-red-400" : "text-muted-foreground"}`}>{titleLen}/60</span>
            </div>
            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="bg-input border-border text-foreground" placeholder="Page title for search engines" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-foreground">Meta Description</Label>
              <span className={`text-xs ${descLen > 160 ? "text-red-400" : "text-muted-foreground"}`}>{descLen}/160</span>
            </div>
            <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="bg-input border-border text-foreground resize-none" rows={3} placeholder="Brief description for search results" />
          </div>
          <div>
            <Label className="text-foreground">Keywords</Label>
            <Input value={form.keywords} onChange={(e) => setForm((p) => ({ ...p, keywords: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="restaurant, kisii, food, garden (comma-separated)" />
          </div>
        </div>

        {/* Open Graph */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Open Graph (Social Preview)</h2>
          <div>
            <Label className="text-foreground">OG Title</Label>
            <Input value={form.ogTitle} onChange={(e) => setForm((p) => ({ ...p, ogTitle: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="Defaults to meta title if empty" />
          </div>
          <div>
            <Label className="text-foreground">OG Description</Label>
            <Textarea value={form.ogDescription} onChange={(e) => setForm((p) => ({ ...p, ogDescription: e.target.value }))} className="bg-input border-border text-foreground mt-1 resize-none" rows={3} placeholder="Defaults to meta description if empty" />
          </div>
          <div>
            <Label className="text-foreground">OG Image URL</Label>
            <Input value={form.ogImage} onChange={(e) => setForm((p) => ({ ...p, ogImage: e.target.value }))} className="bg-input border-border text-foreground mt-1" placeholder="https://..." />
            {form.ogImage && <img src={form.ogImage} alt="OG preview" className="mt-2 w-full h-32 object-cover rounded-lg" onError={(e) => (e.currentTarget.style.display = "none")} />}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-4">Search Preview</h2>
        <div className="bg-background border border-border rounded-xl p-4 max-w-lg">
          <div className="text-xs text-green-400 mb-1">elparaisogarden.com/{page === "home" ? "" : page}</div>
          <div className="text-blue-400 text-lg font-medium hover:underline cursor-pointer">{form.title || "Page Title"}</div>
          <div className="text-muted-foreground text-sm mt-1 leading-relaxed">{form.description || "Page description will appear here in search results..."}</div>
        </div>
      </div>
    </div>
  );
}
