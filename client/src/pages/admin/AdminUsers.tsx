import { useState } from "react";
import { Shield, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-primary/20 text-primary border-primary/30",
  manager: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  editor: "bg-green-500/20 text-green-400 border-green-500/30",
  user: "bg-muted text-muted-foreground border-border",
};

export default function AdminUsers() {
  const [roleDialog, setRoleDialog] = useState<{ id: number; name: string; currentRole: string } | null>(null);
  const [newRole, setNewRole] = useState("user");

  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.admin.users.useQuery();
  const updateRole = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => { utils.admin.users.invalidate(); setRoleDialog(null); toast.success("Role updated"); },
    onError: (e) => toast.error(e.message),
  });

  const openRoleDialog = (user: any) => { setRoleDialog({ id: user.id, name: user.name ?? user.email ?? "User", currentRole: user.role }); setNewRole(user.role); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage user accounts and access roles</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
        <p><strong className="text-foreground">Role hierarchy:</strong> Admin → Manager → Editor → User</p>
        <p className="mt-1">Only <strong className="text-primary">Admin</strong> and <strong className="text-blue-400">Manager</strong> and <strong className="text-green-400">Editor</strong> roles can access the admin panel.</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">User</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Email</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Role</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Joined</th>
              <th className="text-right px-4 py-3 text-muted-foreground font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Loading...</td></tr>
            ) : users && users.length > 0 ? (
              users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-accent/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
                        {(user.name ?? user.email ?? "U").charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground">{user.name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{user.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs border ${ROLE_COLORS[user.role] ?? ROLE_COLORS.user}`}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-accent text-xs" onClick={() => openRoleDialog(user)}>
                      <Shield className="w-3.5 h-3.5 mr-1" /> Change Role
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!roleDialog} onOpenChange={() => setRoleDialog(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader><DialogTitle>Change Role for {roleDialog?.name}</DialogTitle></DialogHeader>
          <div className="py-2">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="admin" className="text-foreground">Admin (full access)</SelectItem>
                <SelectItem value="manager" className="text-foreground">Manager (manage content)</SelectItem>
                <SelectItem value="editor" className="text-foreground">Editor (limited access)</SelectItem>
                <SelectItem value="user" className="text-foreground">User (no admin access)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setRoleDialog(null)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" onClick={() => roleDialog && updateRole.mutate({ userId: roleDialog.id, role: newRole as any })} disabled={updateRole.isPending}>
              {updateRole.isPending ? "Saving..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
