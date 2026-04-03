import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("chatbot_conversations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setConversations(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Conversations</h1>
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session ID</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversations.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.session_id?.slice(0, 12)}...</TableCell>
                  <TableCell>{c.source}</TableCell>
                  <TableCell>{format(new Date(c.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                </TableRow>
              ))}
              {conversations.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No conversations yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminLayout>
  );
}
