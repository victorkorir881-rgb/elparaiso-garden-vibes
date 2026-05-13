import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/auth";
import { useMenuCategories, useMenuItems } from "@/lib/supabase-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Percent, Plus, Minus, RotateCcw, Tag, Calendar, AlertCircle } from "lucide-react";

type FilterType = "all" | "category" | "featured" | "available" | "items";
type Kind = "percent" | "amount";

type Adjustment = {
  id: string;
  label: string;
  filter_type: FilterType;
  category_id: string | null;
  item_ids: string[] | null;
  adjustment_kind: Kind;
  adjustment_value: number;
  starts_at: string;
  ends_at: string | null;
  status: "active" | "reverted" | "expired";
  affected_count: number;
  created_at: string;
  reverted_at: string | null;
};

function useAdjustments() {
  return useQuery({
    queryKey: ["menuPriceAdjustments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("menu_price_adjustments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Adjustment[];
    },
  });
}

function useApplyAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      label: string;
      filter_type: FilterType;
      category_id: string | null;
      item_ids: string[] | null;
      adjustment_kind: Kind;
      adjustment_value: number;
      ends_at: string | null;
    }) => {
      const { data, error } = await (supabase as any).rpc("apply_menu_price_adjustment", {
        _label: input.label,
        _filter_type: input.filter_type,
        _category_id: input.category_id,
        _item_ids: input.item_ids,
        _adjustment_kind: input.adjustment_kind,
        _adjustment_value: input.adjustment_value,
        _ends_at: input.ends_at,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menuPriceAdjustments"] });
      qc.invalidateQueries({ queryKey: ["menuItems"] });
    },
  });
}

function useRevertAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("revert_menu_price_adjustment", {
        _adjustment_id: id,
        _reason: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menuPriceAdjustments"] });
      qc.invalidateQueries({ queryKey: ["menuItems"] });
    },
  });
}

export default function AdminPricing() {
  const { data: categories = [] } = useMenuCategories();
  const { data: items = [] } = useMenuItems();
  const { data: adjustments = [], isLoading: loadingAdj } = useAdjustments();
  const apply = useApplyAdjustment();
  const revert = useRevertAdjustment();
  const qc = useQueryClient();

  // Auto-expire stale adjustments on mount and every 60s.
  useEffect(() => {
    const run = async () => {
      try {
        await (supabase as any).rpc("expire_menu_price_adjustments");
        qc.invalidateQueries({ queryKey: ["menuPriceAdjustments"] });
        qc.invalidateQueries({ queryKey: ["menuItems"] });
      } catch {
        /* noop — admin still sees expired rows even if call fails */
      }
    };
    run();
    const t = setInterval(run, 60_000);
    return () => clearInterval(t);
  }, [qc]);

  // Form state
  const [label, setLabel] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [categoryId, setCategoryId] = useState<string>("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [kind, setKind] = useState<Kind>("percent");
  const [value, setValue] = useState<string>("10");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [endsAt, setEndsAt] = useState<string>(""); // datetime-local

  const numericValue = Number(value);
  const signedValue = direction === "down" ? -Math.abs(numericValue) : Math.abs(numericValue);
  const valueValid = Number.isFinite(numericValue) && numericValue > 0
    && (kind !== "percent" || numericValue < 100);

  // Compute affected items preview client-side.
  const affectedItems = useMemo(() => {
    if (filterType === "all") return items;
    if (filterType === "category") return categoryId ? items.filter((i) => i.category_id === categoryId) : [];
    if (filterType === "featured") return items.filter((i) => i.is_featured);
    if (filterType === "available") return items.filter((i) => i.is_available);
    if (filterType === "items") return items.filter((i) => selectedItemIds.includes(i.id));
    return [];
  }, [items, filterType, categoryId, selectedItemIds]);

  const previewMin = affectedItems.length ? Math.min(...affectedItems.map((i) => Number(i.price))) : 0;
  const previewMax = affectedItems.length ? Math.max(...affectedItems.map((i) => Number(i.price))) : 0;
  const projectPrice = (p: number) =>
    Math.max(0, kind === "percent" ? +(p * (1 + signedValue / 100)).toFixed(2) : +(p + signedValue).toFixed(2));

  const canSubmit =
    label.trim().length > 0 &&
    valueValid &&
    affectedItems.length > 0 &&
    (filterType !== "category" || !!categoryId) &&
    (filterType !== "items" || selectedItemIds.length > 0) &&
    (!endsAt || new Date(endsAt).getTime() > Date.now());

  const handleApply = () => {
    apply.mutate(
      {
        label: label.trim(),
        filter_type: filterType,
        category_id: filterType === "category" ? categoryId : null,
        item_ids: filterType === "items" ? selectedItemIds : null,
        adjustment_kind: kind,
        adjustment_value: signedValue,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      },
      {
        onSuccess: () => {
          toast.success(`Applied to ${affectedItems.length} item${affectedItems.length === 1 ? "" : "s"}`);
          setLabel("");
          setSelectedItemIds([]);
          setEndsAt("");
        },
        onError: (e: any) => toast.error(e?.message ?? "Failed to apply adjustment"),
      },
    );
  };

  const handleRevert = (id: string) => {
    revert.mutate(id, {
      onSuccess: () => toast.success("Prices restored"),
      onError: (e: any) => toast.error(e?.message ?? "Failed to revert"),
    });
  };

  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const activeAdjustments = adjustments.filter((a) => a.status === "active");
  const historyAdjustments = adjustments.filter((a) => a.status !== "active");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Tag className="w-7 h-7 text-primary" /> Pricing
        </h1>
        <p className="text-foreground/60 mt-1">
          Bulk-adjust menu prices by category, featured/available, or hand-picked items —
          by percentage or fixed amount, optionally for a limited period.
        </p>
      </header>

      {/* ───────────── Form ───────────── */}
      <Card className="p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="label">Label *</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='e.g. "Holiday surge" or "Weekend +10%"'
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ends">Ends at (optional)</Label>
            <Input
              id="ends"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
            />
            <p className="text-xs text-foreground/50">
              Leave empty for a permanent change. Otherwise prices auto-revert at this time.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Apply to</Label>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All menu items</SelectItem>
              <SelectItem value="category">A category</SelectItem>
              <SelectItem value="featured">Featured items only</SelectItem>
              <SelectItem value="available">Available items only</SelectItem>
              <SelectItem value="items">Hand-picked items</SelectItem>
            </SelectContent>
          </Select>

          {filterType === "category" && (
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {filterType === "items" && (
            <div className="border border-border rounded-lg max-h-72 overflow-y-auto divide-y divide-border">
              {items.length === 0 && (
                <p className="p-4 text-sm text-foreground/60">No menu items.</p>
              )}
              {items.map((it: any) => {
                const sel = selectedItemIds.includes(it.id);
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggleItem(it.id)}
                    className={`w-full flex items-center justify-between px-4 py-2 text-left text-sm hover:bg-accent/40 ${sel ? "bg-primary/10" : ""}`}
                  >
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={sel} readOnly className="accent-primary" />
                      <span>{it.name}</span>
                    </span>
                    <span className="text-foreground/60">KES {Number(it.price).toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Direction</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={direction === "up" ? "default" : "outline"}
                onClick={() => setDirection("up")}
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-1" /> Increase
              </Button>
              <Button
                type="button"
                variant={direction === "down" ? "default" : "outline"}
                onClick={() => setDirection("down")}
                className="flex-1"
              >
                <Minus className="w-4 h-4 mr-1" /> Decrease
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={kind === "percent" ? "default" : "outline"}
                onClick={() => setKind("percent")}
                className="flex-1"
              >
                <Percent className="w-4 h-4 mr-1" /> Percent
              </Button>
              <Button
                type="button"
                variant={kind === "amount" ? "default" : "outline"}
                onClick={() => setKind("amount")}
                className="flex-1"
              >
                KES
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Value *</Label>
            <div className="relative">
              <Input
                id="value"
                type="number"
                inputMode="decimal"
                min={0}
                step={kind === "percent" ? "0.5" : "1"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 text-sm">
                {kind === "percent" ? "%" : "KES"}
              </span>
            </div>
            {!valueValid && value !== "" && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {kind === "percent" ? "Enter a positive percent below 100" : "Enter a positive amount"}
              </p>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Preview</span>
            <Badge variant={affectedItems.length ? "default" : "outline"}>
              {affectedItems.length} item{affectedItems.length === 1 ? "" : "s"}
            </Badge>
          </div>
          {affectedItems.length > 0 ? (
            <div className="text-sm text-foreground/70">
              Current price range: <span className="font-mono">KES {previewMin.toLocaleString()} – {previewMax.toLocaleString()}</span>
              <br />
              After adjustment: <span className="font-mono text-foreground">
                KES {projectPrice(previewMin).toLocaleString()} – {projectPrice(previewMax).toLocaleString()}
              </span>
              {endsAt && (
                <span className="block mt-1 text-xs text-foreground/60">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  Auto-reverts {new Date(endsAt).toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-foreground/50">No items match this filter.</p>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={!canSubmit || apply.isPending} size="lg" className="w-full md:w-auto">
              {apply.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Apply to {affectedItems.length} item{affectedItems.length === 1 ? "" : "s"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply price adjustment?</AlertDialogTitle>
              <AlertDialogDescription>
                {affectedItems.length} item{affectedItems.length === 1 ? "" : "s"} will be updated by{" "}
                <strong>{direction === "up" ? "+" : "-"}{numericValue}{kind === "percent" ? "%" : " KES"}</strong>.
                {endsAt
                  ? ` Prices will automatically revert on ${new Date(endsAt).toLocaleString()}.`
                  : " This change will stay until you revert it manually."}
                {" "}Customers will see the new prices immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleApply}>Apply now</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>

      {/* ───────────── Active adjustments ───────────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Active adjustments</h2>
        {loadingAdj ? (
          <p className="text-sm text-foreground/60">Loading…</p>
        ) : activeAdjustments.length === 0 ? (
          <Card className="p-6 text-sm text-foreground/60">No active adjustments.</Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Ends</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAdjustments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.label}</TableCell>
                    <TableCell className="text-sm text-foreground/70">
                      {scopeLabel(a, categories)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {a.adjustment_value > 0 ? "+" : ""}
                      {a.adjustment_value}
                      {a.adjustment_kind === "percent" ? "%" : " KES"}
                    </TableCell>
                    <TableCell>{a.affected_count}</TableCell>
                    <TableCell className="text-sm text-foreground/70">
                      {a.ends_at ? new Date(a.ends_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRevert(a.id)}
                        disabled={revert.isPending}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Revert
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      {/* ───────────── History ───────────── */}
      {historyAdjustments.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">History</h2>
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ended</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyAdjustments.slice(0, 50).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.label}</TableCell>
                    <TableCell className="text-sm text-foreground/70">
                      {scopeLabel(a, categories)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {a.adjustment_value > 0 ? "+" : ""}
                      {a.adjustment_value}
                      {a.adjustment_kind === "percent" ? "%" : " KES"}
                    </TableCell>
                    <TableCell>{a.affected_count}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === "expired" ? "secondary" : "outline"}>
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-foreground/70">
                      {a.reverted_at ? new Date(a.reverted_at).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      )}
    </div>
  );
}

function scopeLabel(a: Adjustment, categories: any[]): string {
  switch (a.filter_type) {
    case "all": return "All items";
    case "category": {
      const c = categories.find((x) => x.id === a.category_id);
      return `Category: ${c?.name ?? a.category_id ?? "—"}`;
    }
    case "featured": return "Featured items";
    case "available": return "Available items";
    case "items": return `${(a.item_ids ?? []).length} hand-picked`;
    default: return a.filter_type;
  }
}
