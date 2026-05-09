import { useState } from "react";
import { Shield, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminUsers, useUpdateUserRole, useDeleteAdminUser } from "@/lib/supabase-hooks";
import { useAuth } from "@/lib/auth";

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-primary/20 text-primary border-primary/30",
  admin: "bg-primary/20 text-primary border-primary/30",
  manager: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  staff: "bg-green-500/20 text-green-400 border-green-500/30",
  user: "bg-muted text-muted-foreground border-border",
};

export default function AdminUsers() {
  const [roleDialog, setRoleDialog] = useState<{ id: string; name: string; currentRole: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [newRole, setNewRole] = useState("user");

  // Invite state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviting, setInviting] = useState(false);

  const { user: currentUser, signOut } = useAuth();
  const { data: users, isLoading } = useAdminUsers();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteAdminUser();

  const canInvite = ["super_admin", "admin"].includes(currentUser?.role ?? "");

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Enter a valid email address.");
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-invite-user", {
        body: { email, role: inviteRole },
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string; warning?: string; link?: string } | null;
      if (!payload?.ok) throw new Error(payload?.error ?? "Failed to send invitation");
      if (payload.warning) toast.warning(`${payload.warning}${payload.link ? `\n${payload.link}` : ""}`);
      else toast.success(`Invitation sent to ${email}`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("staff");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const openRoleDialog = (user: any) => { setRoleDialog({ id: user.id, name: user.name ?? user.email ?? "User", currentRole: user.role }); setNewRole(user.role); };
  const openDeleteDialog = (user: any) => { setDeleteDialog({ id: user.id, name: user.name ?? user.email ?? "User" }); setConfirmText(""); };

  const isSelf = deleteDialog?.id === currentUser?.id;
  const confirmOk = confirmText === "DELETE";

  const handleDelete = () => {
    if (!deleteDialog || !confirmOk) return;
    deleteUser.mutate(
      { userId: deleteDialog.id },
      {
        onSuccess: async (res) => {
          toast.success(res.self ? "Your account has been deleted" : "User deleted");
          setDeleteDialog(null);
          if (res.self) {
            // Sign the user out — their session is now orphaned.
            await signOut();
            window.location.href = "/admin/login";
          }
        },
        onError: (e: any) => toast.error(e?.message ?? "Failed to delete account"),
      },
    );
  };


  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage user accounts and access roles</p>
        </div>
        {canInvite && (
          <Button className="bg-primary text-primary-foreground" onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" /> Invite admin
          </Button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
        <p><strong className="text-foreground">Role hierarchy:</strong> Super Admin → Admin → Manager → Staff → User</p>
        <p className="mt-1">Only <strong className="text-primary">Admin</strong> and above roles can access the admin panel.</p>
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
                    <div className="inline-flex gap-2">
                      <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-accent text-xs" onClick={() => openRoleDialog(user)}>
                        <Shield className="w-3.5 h-3.5 mr-1" /> Change Role
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs"
                        onClick={() => openDeleteDialog(user)}
                        title={user.id === currentUser?.id ? "Delete my account" : "Delete user"}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        {user.id === currentUser?.id ? "Delete me" : "Delete"}
                      </Button>
                    </div>
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
              <SelectTrigger className="bg-input border-border text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="super_admin" className="text-foreground">Super Admin (full access)</SelectItem>
                <SelectItem value="admin" className="text-foreground">Admin (full access)</SelectItem>
                <SelectItem value="manager" className="text-foreground">Manager (manage content)</SelectItem>
                <SelectItem value="staff" className="text-foreground">Staff (limited access)</SelectItem>
                <SelectItem value="user" className="text-foreground">User (no admin access)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setRoleDialog(null)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" onClick={() => roleDialog && updateRole.mutate({ userId: roleDialog.id, role: newRole }, { onSuccess: () => { setRoleDialog(null); toast.success("Role updated"); }, onError: (e) => toast.error(e.message) })} disabled={updateRole.isPending}>
              {updateRole.isPending ? "Saving..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {isSelf ? "Delete your account" : `Delete ${deleteDialog?.name}`}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {isSelf
                ? "This permanently removes your admin profile, role, and login. You will be signed out immediately. This action cannot be undone."
                : "This permanently removes the user's admin profile, role and login. Activity log entries they created remain. This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-xs text-muted-foreground">
              Type <strong className="text-foreground">DELETE</strong> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-input border border-border text-foreground text-sm"
              placeholder="DELETE"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setDeleteDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!confirmOk || deleteUser.isPending}
            >
              {deleteUser.isPending ? "Deleting…" : isSelf ? "Delete my account" : "Delete user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite admin dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite admin</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              The invitee will receive a one-time link by email. The link expires in 7 days and can only be used once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm text-foreground">Email</label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="person@example.com" className="bg-input border-border text-foreground mt-1" />
            </div>
            <div>
              <label className="text-sm text-foreground">Role</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="bg-input border-border text-foreground mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {currentUser?.role === "super_admin" && (
                    <SelectItem value="super_admin" className="text-foreground">Super Admin</SelectItem>
                  )}
                  <SelectItem value="admin" className="text-foreground">Admin</SelectItem>
                  <SelectItem value="manager" className="text-foreground">Manager</SelectItem>
                  <SelectItem value="staff" className="text-foreground">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-accent" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" onClick={sendInvite} disabled={inviting}>
              {inviting ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
