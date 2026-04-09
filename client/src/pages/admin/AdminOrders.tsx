import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, Edit2, Eye } from "lucide-react";
import { toast } from "sonner";

const statusOptions = ["pending", "confirmed", "preparing", "ready", "out-for-delivery", "completed", "cancelled"];
const orderTypeOptions = ["dine-in", "takeaway", "delivery"];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-purple-100 text-purple-800",
  ready: "bg-green-100 text-green-800",
  "out-for-delivery": "bg-indigo-100 text-indigo-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function AdminOrders() {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [editingStatus, setEditingStatus] = useState("");
  const [editingNotes, setEditingNotes] = useState("");
  const [editingTime, setEditingTime] = useState("");

  const { data: orders = [], isLoading } = trpc.orders.list.useQuery({
    status: filterStatus || undefined,
    orderType: filterType || undefined,
    search: search || undefined,
  });

  const { data: stats } = trpc.orders.stats.useQuery();

  const updateOrder = trpc.orders.update.useMutation({
    onSuccess: () => {
      toast.success("Order updated successfully");
      setSelectedOrder(null);
    },
    onError: () => toast.error("Failed to update order"),
  });

  const deleteOrder = trpc.orders.delete.useMutation({
    onSuccess: () => {
      toast.success("Order deleted");
      setSelectedOrder(null);
    },
    onError: () => toast.error("Failed to delete order"),
  });

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;
    await updateOrder.mutateAsync({
      id: selectedOrder.id,
      status: editingStatus as any,
      adminNotes: editingNotes,
      estimatedTime: editingTime ? parseInt(editingTime) : undefined,
    });
  };

  const handleDeleteOrder = async (id: number) => {
    if (confirm("Are you sure you want to delete this order?")) {
      await deleteOrder.mutateAsync({ id });
    }
  };

  const openOrderDetails = (order: any) => {
    setSelectedOrder(order);
    setEditingStatus(order.status);
    setEditingNotes(order.adminNotes || "");
    setEditingTime(order.estimatedTime?.toString() || "");
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order: any) => {
      if (filterStatus && order.status !== filterStatus) return false;
      if (filterType && order.orderType !== filterType) return false;
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          order.orderNumber.toLowerCase().includes(searchLower) ||
          order.customerName.toLowerCase().includes(searchLower) ||
          order.customerPhone.includes(search)
        );
      }
      return true;
    });
  }, [orders, filterStatus, filterType, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display mb-2">Orders Management</h1>
        <p className="text-foreground/60">Manage customer orders and track delivery status</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-sm text-foreground/60 mb-1">Total Orders</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-foreground/60 mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-foreground/60 mb-1">Preparing</p>
            <p className="text-2xl font-bold text-purple-600">{stats.preparing}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-foreground/60 mb-1">Out for Delivery</p>
            <p className="text-2xl font-bold text-indigo-600">{stats.outForDelivery}</p>
          </Card>
        </div>
      )}

      <Card className="p-4">
        <div className="grid md:grid-cols-4 gap-4">
          <Input
            placeholder="Search by order #, name, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              {orderTypeOptions.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              setFilterStatus("");
              setFilterType("");
              setSearch("");
            }}
          >
            Reset Filters
          </Button>
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
                  <p className="font-semibold font-display">{order.orderNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground/60">Customer</p>
                  <p className="font-medium">{order.customerName}</p>
                  <p className="text-xs text-foreground/60">{order.customerPhone}</p>
                </div>
                <div>
                  <p className="text-sm text-foreground/60">Type</p>
                  <Badge variant="outline" className="capitalize">
                    {order.orderType}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-foreground/60">Status</p>
                  <Badge className={statusColors[order.status]}>{order.status}</Badge>
                </div>
                <div className="flex gap-2 justify-end">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openOrderDetails(order)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Order Details: {selectedOrder?.orderNumber}</DialogTitle>
                      </DialogHeader>
                      {selectedOrder && (
                        <div className="space-y-4">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium">Customer Name</label>
                              <p className="text-foreground/70">{selectedOrder.customerName}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Phone</label>
                              <p className="text-foreground/70">{selectedOrder.customerPhone}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Order Type</label>
                              <p className="text-foreground/70 capitalize">{selectedOrder.orderType}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Total Amount</label>
                              <p className="text-lg font-bold text-primary">KES {parseFloat(selectedOrder.totalAmount).toLocaleString()}</p>
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
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <label className="text-sm font-medium mb-2 block">Estimated Time (minutes)</label>
                            <Input
                              type="number"
                              value={editingTime}
                              onChange={(e) => setEditingTime(e.target.value)}
                              placeholder="e.g., 30"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium mb-2 block">Admin Notes</label>
                            <Textarea
                              value={editingNotes}
                              onChange={(e) => setEditingNotes(e.target.value)}
                              placeholder="Add internal notes..."
                              rows={3}
                            />
                          </div>

                          <div className="flex gap-2 justify-end pt-4 border-t">
                            <Button
                              variant="outline"
                              onClick={() => handleDeleteOrder(selectedOrder.id)}
                              disabled={deleteOrder.isPending}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                            <Button
                              onClick={handleUpdateOrder}
                              disabled={updateOrder.isPending}
                            >
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
    </div>
  );
}
