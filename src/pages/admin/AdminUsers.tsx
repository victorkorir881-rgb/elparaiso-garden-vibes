import { useState } from "react";
import { Shield, Trash2, UserPlus, Mail, RefreshCw, Send, CheckCircle2, Clock, ScrollText, Link2, Ban, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminUsers, useUpdateUserRole, useDeleteAdminUser, usePendingInvitations, useInviteAudit, type InviteAuditEvent } from "@/lib/supabase-hooks";
import { useAuth } from "@/lib/auth";

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-primary/20 text-primary border-primary/30",
  admin: "bg-primary/20 text-primary border-primary/30",
  manager: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  staff: "bg-green-500/20 text-green-400 border-green-500/30",
  user: "bg-muted text-muted-foreground border-border",
};

const INVITE_EVENT_META: Record<InviteAuditEvent, { label: string; icon: typeof Send; bg: string; fg: string }> = {
  invite_sent:     { label: "SENT",     icon: Send,         bg: "bg-blue-500/15",  fg: "text-blue-400" },
  invite_accepted: { label: "ACCEPTED", icon: CheckCircle2, bg: "bg-green-500/15", fg: "text-green-400" },
  invite_expired:  { label: "EXPIRED",  icon: Clock,        bg: "bg-muted",        fg: "text-muted-foreground" },
  invite_revoked:  { label: "REVOKED",  icon: XCircle,      bg: "bg-destructive/15", fg: "text-destructive" },
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

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const { user: currentUser, signOut } = useAuth();
  const { data: users, isLoading } = useAdminUsers();
  const { data: pending, isLoading: pendingLoading } = usePendingInvitations();
  const { data: auditRows, isLoading: auditLoading } = useInviteAudit(50);
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteAdminUser();
  const qc = useQueryClient();

  const canInvite = ["super_admin", "admin"].includes(currentUser?.role ?? "");

  const inviteEmailFn = async (email: string, role: string) => {
    const { data, error } = await supabase.functions.invoke("admin-invite-user", {
      body: { email, role },
    });
    if (error) throw error;
    const payload = data as { ok?: boolean; error?: string; warning?: string; link?: string } | null;
    if (!payload?.ok) throw new Error(payload?.error ?? "Failed to send invitation");
    if (payload.warning && payload.link) {
      try { await navigator.clipboard.writeText(payload.link); } catch { /* ignore */ }
      toast.warning(`${payload.warning} (link copied to clipboard)`, { duration: 12000 });
    } else {
      toast.success(`Invitation sent to ${email}`);
    }
  };

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Enter a valid email address.");
    setInviting(true);
    try {
      await inviteEmailFn(email, inviteRole);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("staff");
      qc.invalidateQueries({ queryKey: ["adminPendingInvitations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const resendInvite = async (inv: { id: string; email: string; role: string }) => {
    setResendingId(inv.id);
    try {
      await inviteEmailFn(inv.email, inv.role);
      qc.invalidateQueries({ queryKey: ["adminPendingInvitations"] });
      qc.invalidateQueries({ queryKey: ["adminInviteAudit"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resend invitation");
    } finally {
      setResendingId(null);
    }
  };

  const copyInviteLink = async (inv: { id: string; email: string; role: string }) => {
    setCopyingId(inv.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-invite-user", {
        body: { email: inv.email, role: inv.role, returnLinkOnly: true },
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string; link?: string } | null;
      if (!payload?.ok || !payload.link) throw new Error(payload?.error ?? "Failed to generate link");
      try {
        await navigator.clipboard.writeText(payload.link);
        toast.success("Invitation link copied to clipboard");
      } catch {
        toast.message("Invitation link", { description: payload.link, duration: 15000 });
      }
      qc.invalidateQueries({ queryKey: ["adminPendingInvitations"] });
      qc.invalidateQueries({ queryKey: ["adminInviteAudit"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to copy invitation link");
    } finally {
      setCopyingId(null);
    }
  };

  const revokeInvite = async (inv: { id: string; email: string; role: string }) => {
    if (!window.confirm(`Revoke the pending invitation for ${inv.email}? The current link will stop working.`)) return;
    setRevokingId(inv.id);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await (supabase as any)
        .from("admin_invitations")
        .update({ revoked_at: nowIso, revoked_by: currentUser?.id ?? null })
        .eq("id", inv.id)
        .is("accepted_at", null)
        .is("revoked_at", null);
      if (error) throw error;
      // Audit log entry so the trail shows REVOKED with actor attribution.
      await (supabase as any).from("admin_activity_log").insert({
        admin_id: currentUser?.id ?? null,
        action: "invite_revoked",
        table_name: "admin_invitations",
        record_id: inv.id,
        new_data: { email: inv.email, role: inv.role, revoked_at: nowIso },
      });
      toast.success(`Invitation for ${inv.email} revoked`);
      qc.invalidateQueries({ queryKey: ["adminPendingInvitations"] });
      qc.invalidateQueries({ queryKey: ["adminInviteAudit"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke invitation");
    } finally {
      setRevokingId(null);
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

      {canInvite && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Pending invitations</h2>
              {pending && pending.length > 0 && (
                <Badge className="bg-primary/15 text-primary border border-primary/30 text-xs">{pending.length}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">Unaccepted invites ready to copy, resend, or revoke</p>
          </div>
          {pendingLoading ? (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm">Loading…</div>
          ) : pending && pending.length > 0 ? (
            <ul className="divide-y divide-border">
              {pending.map((inv) => {
                const expires = new Date(inv.expires_at);
                const daysLeft = Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const expiryText = daysLeft > 0
                  ? `Suggested follow-up in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
                  : "Invite link remains usable unless revoked";
                return (
                  <li key={inv.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[160px]">
                      <div className="text-sm font-medium text-foreground break-all">{inv.email}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {expiryText} · sent {new Date(inv.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge className={`text-xs border ${ROLE_COLORS[inv.role] ?? ROLE_COLORS.user}`}>{inv.role}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border text-foreground hover:bg-accent text-xs"
                      onClick={() => copyInviteLink(inv)}
                      disabled={copyingId === inv.id || revokingId === inv.id}
                      title="Generate a fresh one-time link and copy it to your clipboard"
                    >
                      <Link2 className="w-3.5 h-3.5 mr-1" />
                      {copyingId === inv.id ? "Copying…" : "Copy link"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border text-foreground hover:bg-accent text-xs"
                      onClick={() => resendInvite(inv)}
                      disabled={resendingId === inv.id || revokingId === inv.id}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1 ${resendingId === inv.id ? "animate-spin" : ""}`} />
                      {resendingId === inv.id ? "Resending…" : "Resend email"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs"
                      onClick={() => revokeInvite(inv)}
                      disabled={revokingId === inv.id || resendingId === inv.id || copyingId === inv.id}
                      title="Cancel this invitation so the current link can no longer be used"
                    >
                      <Ban className="w-3.5 h-3.5 mr-1" />
                      {revokingId === inv.id ? "Revoking…" : "Revoke"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm">No pending invitations.</div>
          )}
        </div>
      )}

      {canInvite && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Invitations audit trail</h2>
              {auditRows && auditRows.length > 0 && (
                <Badge className="bg-muted text-muted-foreground border border-border text-xs">{auditRows.length}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">Most recent 50 invitation events</p>
          </div>
          {auditLoading ? (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm">Loading…</div>
          ) : auditRows && auditRows.length > 0 ? (
            <ul className="divide-y divide-border">
              {auditRows.map((row) => {
                const meta = INVITE_EVENT_META[row.event] ?? INVITE_EVENT_META.invite_sent;
                const Icon = meta.icon;
                return (
                  <li key={row.id} className="px-4 py-3 flex items-start gap-3">
                    <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${meta.fg}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-semibold ${meta.fg}`}>{meta.label}</span>
                        <span className="text-sm text-foreground break-all">{row.email ?? "—"}</span>
                        {row.role && (
                          <Badge className={`text-[10px] border ${ROLE_COLORS[row.role] ?? ROLE_COLORS.user}`}>{row.role}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(row.event_at).toLocaleString()}
                        {(row.event === "invite_sent" || row.event === "invite_revoked") && row.actor_id && (
                          <> · by {row.actor_name || row.actor_email || row.actor_id.slice(0, 8)}</>
                        )}
                        {row.event === "invite_accepted" && (
                          <> · activated by invitee</>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm">No invitation events yet.</div>
          )}
        </div>
      )}

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
