import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Check, X, Trash2, Star } from "lucide-react";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    const { data } = await supabase.from("reviews").select("*").order("created_at", { ascending: false });
    setReviews(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleApproved = async (r: any) => {
    await supabase.from("reviews").update({ is_approved: !r.is_approved }).eq("id", r.id);
    toast({ title: r.is_approved ? "Review unapproved" : "Review approved" });
    fetchData();
  };

  const toggleFeatured = async (r: any) => {
    await supabase.from("reviews").update({ is_featured: !r.is_featured }).eq("id", r.id);
    fetchData();
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Delete this review?")) return;
    await supabase.from("reviews").delete().eq("id", id);
    toast({ title: "Review deleted" });
    fetchData();
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Reviews Moderation</h1>
      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Author</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead>Featured</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.author_name}</TableCell>
                  <TableCell>
                    <div className="flex">{Array.from({ length: r.rating }, (_, i) => <Star key={i} size={12} className="text-amber fill-amber" />)}</div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{r.comment || "—"}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleApproved(r)} className={`w-3 h-3 rounded-full ${r.is_approved ? "bg-green-400" : "bg-red-400"}`} />
                  </TableCell>
                  <TableCell>
                    <button onClick={() => toggleFeatured(r)} className={`w-3 h-3 rounded-full ${r.is_featured ? "bg-amber" : "bg-muted"}`} />
                  </TableCell>
                  <TableCell>{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => deleteReview(r.id)} className="text-destructive"><Trash2 size={14} /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {reviews.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No reviews yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminLayout>
  );
}
