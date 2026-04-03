import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  intent: string;
  keywords: any;
  is_active: boolean;
  priority: number;
}

export default function FAQsPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FAQ | null>(null);
  const [form, setForm] = useState({ id: "", question: "", answer: "", intent: "", keywords: "", priority: 0 });
  const { toast } = useToast();

  const fetchFAQs = async () => {
    const { data } = await supabase.from("chatbot_faqs").select("*").order("priority", { ascending: false });
    setFaqs(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchFAQs(); }, []);

  const resetForm = () => {
    setForm({ id: "", question: "", answer: "", intent: "", keywords: "", priority: 0 });
    setEditing(null);
  };

  const openEdit = (faq: FAQ) => {
    setEditing(faq);
    setForm({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      intent: faq.intent,
      keywords: Array.isArray(faq.keywords) ? (faq.keywords as string[]).join(", ") : "",
      priority: faq.priority,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const keywordsArr = form.keywords.split(",").map((k: string) => k.trim()).filter(Boolean);
    if (editing) {
      const { error } = await supabase.from("chatbot_faqs").update({
        question: form.question, answer: form.answer, intent: form.intent,
        keywords: keywordsArr, priority: form.priority,
      }).eq("id", editing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const id = form.id || form.intent.toLowerCase().replace(/\s+/g, "-");
      const { error } = await supabase.from("chatbot_faqs").insert({
        id, question: form.question, answer: form.answer, intent: form.intent,
        keywords: keywordsArr, priority: form.priority,
      });
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: editing ? "FAQ updated" : "FAQ created" });
    setDialogOpen(false);
    resetForm();
    fetchFAQs();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this FAQ?")) return;
    await supabase.from("chatbot_faqs").delete().eq("id", id);
    toast({ title: "FAQ deleted" });
    fetchFAQs();
  };

  const toggleActive = async (faq: FAQ) => {
    await supabase.from("chatbot_faqs").update({ is_active: !faq.is_active }).eq("id", faq.id);
    fetchFAQs();
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">FAQs Manager</h1>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-fire"><Plus size={16} className="mr-2" />Add FAQ</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Edit FAQ" : "New FAQ"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {!editing && (
                <div className="space-y-2">
                  <Label>ID (slug)</Label>
                  <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="auto-generated from intent" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Intent</Label>
                <Input value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value })} placeholder="e.g. hours, menu, location" required />
              </div>
              <div className="space-y-2">
                <Label>Question</Label>
                <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Answer</Label>
                <Textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={4} required />
              </div>
              <div className="space-y-2">
                <Label>Keywords (comma-separated)</Label>
                <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? "Update" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Intent</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faqs.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.intent}</TableCell>
                  <TableCell className="max-w-xs truncate">{f.question}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleActive(f)} className={`w-3 h-3 rounded-full ${f.is_active ? "bg-green-400" : "bg-red-400"}`} />
                  </TableCell>
                  <TableCell>{f.priority}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(f)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(f.id)} className="text-destructive"><Trash2 size={14} /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {faqs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No FAQs yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminLayout>
  );
}
