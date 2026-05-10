import { useState, useMemo } from "react";
import {
  useOrders,
  useOrderStats,
  useUpdateOrder,
  useDeleteOrder,
  useOrderPayments,
  useRefundPayment,
  usePendingManualClaims,
} from "@/lib/supabase-hooks";
import { useVerifyManualPayment } from "@/lib/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, Edit2, Eye, Download, Undo2, ShieldCheck, ShieldX, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/csv-export";

const statusOptions = ["pending", "confirmed", "preparing", "ready", "out-for-delivery", "completed", "cancelled"];
const orderTypeOptions = ["dine-in", "takeaway", "delivery"];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30",
  confirmed: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  preparing: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
  ready: "bg-green-500/15 text-green-300 border border-green-500/30",
  "out-for-delivery": "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-300 border border-red-500/30",
};

export default function AdminOrders() {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [editingStatus, setEditingStatus] = useState("");
  const [editingNotes, setEditingNotes] = useState("");
  const [editingTime, setEditingTime] = useState("");
  const [refundTarget, setRefundTarget] = useState<{ id: string; amount: number; receipt: string | null } | null>(null);
  const [refundReason, setRefundReason] = useState("");

  const { data: orders = [], isLoading } = useOrders({
    status: filterStatus && filterStatus !== "all" ? filterStatus : undefined,
    search: search || undefined,
  });

  const { data: stats } = useOrderStats();
  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const { data: orderPayments = [] } = useOrderPayments(selectedOrder?.id);
  const refundPayment = useRefundPayment();
  const { data: pendingClaims = [] } = usePendingManualClaims();
  const verifyManual = useVerifyManualPayment();
  const [verifyNotes, setVerifyNotes] = useState<Record<string, string>>({});

  const handleVerifyManual = (paymentId: string, approve: boolean) => {
    verifyManual.mutate(
      { paymentId, approve, notes: verifyNotes[paymentId] || undefined },
      {
        onSuccess: (d) => {
          toast.success(d.approved ? "Payment verified — customer notified." : "Claim rejected.");
          setVerifyNotes((s) => { const { [paymentId]: _, ...rest } = s; return rest; });
        },
        onError: (e) => toast.error(e.message ?? "Verification failed"),
      },
    );
  };

  const handleRefund = () => {
    if (!refundTarget) return;
    refundPayment.mutate(
      { paymentId: refundTarget.id, amount: refundTarget.amount, reason: refundReason || undefined },
      {
        onSuccess: () => {
          toast.success("Refund initiated. Awaiting M-Pesa confirmation.");
          setRefundTarget(null);
          setRefundReason("");
        },
        onError: (e: any) => toast.error(e?.message ?? "Refund failed"),
      },
    );
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;
    updateOrder.mutate({
      id: selectedOrder.id,
      status: editingStatus,
      admin_notes: editingNotes,
      estimated_time: editingTime ? parseInt(editingTime) : undefined,
    }, {
      onSuccess: () => { toast.success("Order updated"); setSelectedOrder(null); },
      onError: () => toast.error("Failed to update order"),
    });
  };

  const handleDeleteOrder = async (id: string) => {
    if (confirm("Are you sure you want to delete this order?")) {
      deleteOrder.mutate(id, {
        onSuccess: () => { toast.success("Order deleted"); setSelectedOrder(null); },
        onError: () => toast.error("Failed to delete order"),
      });
    }
  };

  const openOrderDetails = (order: any) => {
    setSelectedOrder(order);
    setEditingStatus(order.status);
    setEditingNotes(order.admin_notes || "");
    setEditingTime(order.estimated_time?.toString() || "");
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order: any) => {
      if (filterType && filterType !== "all" && order.order_type !== filterType) return false;
      return true;
    });
  }, [orders, filterType]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display mb-2">Orders Management</h1>
          <p className="text-foreground/60">Manage customer orders and track delivery status</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={filteredOrders.length === 0}
          onClick={() =>
            downloadCsv("orders", filteredOrders, [
              { header: "Created", value: (o: any) => o.created_at },
              { header: "Order #", value: (o: any) => o.order_number },
              { header: "Customer", value: (o: any) => o.customer_name },
              { header: "Phone", value: (o: any) => o.customer_phone },
              { header: "Type", value: (o: any) => o.order_type },
              { header: "Status", value: (o: any) => o.status },
              { header: "Total (KES)", value: (o: any) => o.total_amount },
              { header: "Items", value: (o: any) => Array.isArray(o.items) ? o.items.map((i: any) => `${i.name} x${i.quantity}`).join("; ") : "" },
              { header: "Address", value: (o: any) => o.delivery_address ?? "" },
              { header: "Notes", value: (o: any) => o.admin_notes ?? "" },
            ])
          }
        >
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      {pendingClaims.length > 0 && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-200">
                {pendingClaims.length} M-Pesa payment{pendingClaims.length === 1 ? "" : "s"} awaiting manual verification
              </p>
              <p className="text-xs text-foreground/70 mt-0.5">
                The customer typed an M-Pesa reference because the auto-callback didn't reach us. Cross-check on the M-Pesa Business portal, then approve or reject inside the order.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {pendingClaims.slice(0, 6).map((c: any) => {
                  const o = orders.find((x: any) => x.id === c.order_id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => o && openOrderDetails(o)}
                      className="text-xs font-mono px-2 py-1 rounded border border-amber-500/40 bg-background/40 hover:bg-amber-500/10"
                      disabled={!o}
                    >
                      {c.orders?.order_number ?? "#"} · {c.manual_reference}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-sm text-foreground/60 mb-1">Total Orders</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-foreground/60 mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-300">{stats.pending}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-foreground/60 mb-1">Preparing</p>
            <p className="text-2xl font-bold text-purple-300">{stats.preparing}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-foreground/60 mb-1">Out for Delivery</p>
            <p className="text-2xl font-bold text-indigo-300">{stats.outForDelivery}</p>
          </Card>
        </div>
      )}

      <Card className="p-4">
        <div className="grid md:grid-cols-4 gap-4">
          <Input placeholder="Search by order #, name, or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={filterStatus || "all"} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType || "all"} onValueChange={setFilterType}>
            <SelectTrigger><SelectValue placeholder="Filter by type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {orderTypeOptions.map((type) => (
                <SelectItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => { setFilterStatus("all"); setFilterType("all"); setSearch(""); }}>Reset Filters</Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-foreground/60">No orders found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order: any) => (
            <Card key={order.id} className="p-4">
              <div className="grid md:grid-cols-5 gap-4 items-center">
                <div>
                  <p className="text-sm text-foreground/60">Order #</p>
                  <p className="font-semibold font-display">{order.order_number}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground/60">Customer</p>
                  <p className="font-medium">{order.customer_name}</p>
                  <p className="text-xs text-foreground/60">{order.customer_phone}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground/60">Type</p>
                  <Badge variant="outline" className="capitalize">{order.order_type}</Badge>
                </div>
                <div>
                  <p className="text-sm text-foreground/60">Status</p>
                  <Badge className={statusColors[order.status]}>{order.status}</Badge>
                </div>
                <div className="flex gap-2 justify-end">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => openOrderDetails(order)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Order Details: {selectedOrder?.order_number}</DialogTitle>
                      </DialogHeader>
                      {selectedOrder && (
                        <div className="space-y-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium">Customer Name</label>
                              <p className="text-foreground/70">{selectedOrder.customer_name}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Phone</label>
                              <p className="text-foreground/70">{selectedOrder.customer_phone}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Order Type</label>
                              <p className="text-foreground/70 capitalize">{selectedOrder.order_type}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Total Amount</label>
                              <p className="text-lg font-bold text-primary">KES {parseFloat(selectedOrder.total_amount).toLocaleString()}</p>
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium mb-2 block">Items</label>
                            <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                              {Array.isArray(selectedOrder.items) &&
                                selectedOrder.items.map((item: any, idx: number) => (
                                  <div key={idx} className="flex justify-between">
                                    <span>{item.name} x{item.quantity}</span>
                                    <span>KES {(parseFloat(item.price) * item.quantity).toLocaleString()}</span>
                                  </div>
                                ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium mb-2 block">Status</label>
                            <Select value={editingStatus} onValueChange={setEditingStatus}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((status) => (
                                  <SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <label className="text-sm font-medium mb-2 block">Estimated Time (minutes)</label>
                            <Input type="number" value={editingTime} onChange={(e) => setEditingTime(e.target.value)} placeholder="e.g., 30" />
                          </div>

                          <div>
                            <label className="text-sm font-medium mb-2 block">Admin Notes</label>
                            <Textarea value={editingNotes} onChange={(e) => setEditingNotes(e.target.value)} placeholder="Add internal notes..." rows={3} />
                          </div>

                          <div>
                            <label className="text-sm font-medium mb-2 block">Payments</label>
                            {orderPayments.length === 0 ? (
                              <p className="text-sm text-foreground/60">No M-Pesa payment attempts recorded.</p>
                            ) : (
                              <div className="space-y-2">
                                {orderPayments.map((p) => (
                                  <div key={p.id} className="bg-muted p-3 rounded-lg text-sm space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-mono text-xs">{p.mpesa_receipt_number ?? p.manual_reference ?? "—"}</span>
                                          <Badge variant="outline" className="capitalize">{p.status}</Badge>
                                          {p.manual_claim_status === "claimed" && (
                                            <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                              Manual claim — awaiting verification
                                            </Badge>
                                          )}
                                          {p.manual_claim_status === "verified" && (
                                            <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                              Manually verified
                                            </Badge>
                                          )}
                                          {p.manual_claim_status === "rejected" && (
                                            <Badge className="bg-red-500/15 text-red-300 border border-red-500/30">
                                              Claim rejected
                                            </Badge>
                                          )}
                                          {p.refund_status !== "none" && (
                                            <Badge
                                              className={
                                                p.refund_status === "refunded"
                                                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                                  : p.refund_status === "pending"
                                                  ? "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30"
                                                  : "bg-red-500/15 text-red-300 border border-red-500/30"
                                              }
                                            >
                                              Refund: {p.refund_status}
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-xs text-foreground/60 mt-1">
                                          KES {p.amount.toLocaleString()} · {new Date(p.created_at).toLocaleString()}
                                          {p.refund_result_desc ? ` · ${p.refund_result_desc}` : ""}
                                        </p>
                                      </div>
                                      {p.status === "success" && (p.refund_status === "none" || p.refund_status === "failed") && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setRefundTarget({ id: p.id, amount: p.amount, receipt: p.mpesa_receipt_number });
                                            setRefundReason("");
                                          }}
                                        >
                                          <Undo2 className="w-4 h-4 mr-1" /> Refund
                                        </Button>
                                      )}
                                    </div>

                                    {p.manual_claim_status === "claimed" && (
                                      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
                                        <p className="text-xs text-amber-200">
                                          Customer typed reference{" "}
                                          <span className="font-mono font-semibold">{p.manual_reference}</span>
                                          {p.manual_claimed_at ? ` at ${new Date(p.manual_claimed_at).toLocaleString()}` : ""}.
                                          Confirm against M-Pesa Business portal before approving.
                                        </p>
                                        <Input
                                          placeholder="Internal note (optional)"
                                          value={verifyNotes[p.id] ?? ""}
                                          onChange={(e) => setVerifyNotes((s) => ({ ...s, [p.id]: e.target.value }))}
                                          className="h-8 text-xs"
                                        />
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            className="flex-1"
                                            disabled={verifyManual.isPending}
                                            onClick={() => handleVerifyManual(p.id, true)}
                                          >
                                            <ShieldCheck className="w-4 h-4 mr-1" /> Approve & notify customer
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={verifyManual.isPending}
                                            onClick={() => handleVerifyManual(p.id, false)}
                                          >
                                            <ShieldX className="w-4 h-4 mr-1" /> Reject
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 justify-end pt-4 border-t">
                            <Button variant="outline" onClick={() => handleDeleteOrder(selectedOrder.id)} disabled={deleteOrder.isPending}>
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </Button>
                            <Button onClick={handleUpdateOrder} disabled={updateOrder.isPending}>
                              {updateOrder.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Edit2 className="w-4 h-4 mr-2" />}
                              Save Changes
                            </Button>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!refundTarget} onOpenChange={(o) => { if (!o) setRefundTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund payment</DialogTitle>
          </DialogHeader>
          {refundTarget && (
            <div className="space-y-4">
              <p className="text-sm text-foreground/70">
                This will send a Daraja Reversal request for receipt{" "}
                <span className="font-mono">{refundTarget.receipt ?? "—"}</span>{" "}
                of <strong>KES {refundTarget.amount.toLocaleString()}</strong>.
                The result is asynchronous — refund status updates when M-Pesa
                confirms.
              </p>
              <div>
                <label className="text-sm font-medium mb-2 block">Reason (optional, ≤100 chars)</label>
                <Input
                  value={refundReason}
                  maxLength={100}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Customer cancelled order"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)} disabled={refundPayment.isPending}>
              Cancel
            </Button>
            <Button onClick={handleRefund} disabled={refundPayment.isPending}>
              {refundPayment.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Undo2 className="w-4 h-4 mr-2" />}
              Initiate refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
