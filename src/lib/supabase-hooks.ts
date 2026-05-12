import { supabase } from "@/integrations/supabase/client";
import { enforceRateLimit } from "@/lib/rate-limit";
import { fireTransactionalEmail } from "@/lib/email";
import { fireTransactionalSms } from "@/lib/sms";
// WhatsApp notifications are temporarily disabled (kept for future re-enable).

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── SITE SETTINGS ─────────────────────────────────────────────────────────
let _settingsRealtimeBound = false;
function bindSettingsRealtime(qc: ReturnType<typeof useQueryClient>) {
  if (_settingsRealtimeBound || typeof window === "undefined") return;
  _settingsRealtimeBound = true;
  supabase
    .channel("public:site_settings")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "site_settings" },
      () => qc.invalidateQueries({ queryKey: ["settings"] }),
    )
    .subscribe();
}

export function useSettings() {
  const qc = useQueryClient();
  bindSettingsRealtime(qc);
  return useQuery({
    queryKey: ["settings"],
    // Settings are small and customer-facing — keep them fresh.
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*");
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { map[r.key] = r.value ?? ""; });
      return map;
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      // Single round-trip batch upsert — was N round trips, one per key.
      const rows = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
        category: "general",
      }));
      if (rows.length === 0) return;
      const { error } = await supabase
        .from("site_settings")
        .upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    // Optimistic — write the new map straight into the cache so the UI
    // reflects the change instantly while the server round-trip completes.
    onMutate: async (settings) => {
      await qc.cancelQueries({ queryKey: ["settings"] });
      const prev = qc.getQueryData<Record<string, string>>(["settings"]);
      qc.setQueryData<Record<string, string>>(["settings"], {
        ...(prev ?? {}),
        ...settings,
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["settings"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

// ─── SEO SETTINGS ──────────────────────────────────────────────────────────
export function useSeoByPage(page: string) {
  return useQuery({
    queryKey: ["seo", page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seo_settings")
        .select("*")
        .eq("page", page)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertSeo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { page: string; seo_title?: string; meta_description?: string; og_title?: string; og_description?: string; og_image?: string; canonical_url?: string }) => {
      const { page, ...rest } = input;
      const { error } = await supabase
        .from("seo_settings")
        .upsert({ page, ...rest }, { onConflict: "page" });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["seo", vars.page] }),
  });
}

// ─── MENU CATEGORIES ───────────────────────────────────────────────────────
export function useMenuCategories(activeOnly = false) {
  return useQuery({
    queryKey: ["menuCategories", activeOnly],
    queryFn: async () => {
      let q = supabase.from("menu_categories").select("*").order("sort_order");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateMenuCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string; description?: string; sort_order?: number; is_active?: boolean }) => {
      const { error } = await supabase.from("menu_categories").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menuCategories"] }),
  });
}

export function useUpdateMenuCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; sort_order?: number; is_active?: boolean }) => {
      const { error } = await supabase.from("menu_categories").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menuCategories"] }),
  });
}

export function useDeleteMenuCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menuCategories"] }),
  });
}

// ─── MENU ITEMS ────────────────────────────────────────────────────────────
export function useMenuItems(opts?: { categoryId?: string; featuredOnly?: boolean; availableOnly?: boolean; search?: string }) {
  return useQuery({
    queryKey: ["menuItems", opts],
    queryFn: async () => {
      let q = supabase.from("menu_items").select("*").order("sort_order").order("name");
      if (opts?.categoryId) q = q.eq("category_id", opts.categoryId);
      if (opts?.featuredOnly) q = q.eq("is_featured", true);
      if (opts?.availableOnly) q = q.eq("is_available", true);
      if (opts?.search) q = q.ilike("name", `%${opts.search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; category_id: string; name: string; description?: string; price: number; image_url?: string; is_available?: boolean; is_featured?: boolean; sort_order?: number }) => {
      const { error } = await supabase.from("menu_items").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menuItems"] }),
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; category_id?: string; name?: string; description?: string; price?: number; image_url?: string; is_available?: boolean; is_featured?: boolean; sort_order?: number }) => {
      const { error } = await supabase.from("menu_items").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menuItems"] }),
  });
}

export function useDeleteMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menuItems"] }),
  });
}

// ─── EVENTS ────────────────────────────────────────────────────────────────
export function useEvents(opts?: { activeOnly?: boolean }) {
  return useQuery({
    queryKey: ["events", opts],
    queryFn: async () => {
      let q = supabase.from("events").select("*").order("created_at", { ascending: false });
      if (opts?.activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; description?: string; event_date: string; start_time?: string; end_time?: string; image_url?: string; is_active?: boolean; is_featured?: boolean }) => {
      const { error } = await supabase.from("events").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; description?: string; event_date?: string; start_time?: string; end_time?: string; image_url?: string; is_active?: boolean; is_featured?: boolean }) => {
      const { error } = await supabase.from("events").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

// ─── GALLERY ───────────────────────────────────────────────────────────────
export function useGalleryImages(opts?: { category?: string; featuredOnly?: boolean }) {
  return useQuery({
    queryKey: ["gallery", opts],
    queryFn: async () => {
      let q = supabase.from("gallery_images").select("*").order("sort_order").order("created_at", { ascending: false });
      if (opts?.category && opts.category !== "All") q = q.eq("category", opts.category);
      if (opts?.featuredOnly) q = q.eq("is_featured", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateGalleryImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { image_url: string; category?: string; alt_text?: string; is_featured?: boolean; sort_order?: number }) => {
      const { error } = await supabase.from("gallery_images").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gallery"] }),
  });
}

export function useUpdateGalleryImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; category?: string; alt_text?: string; is_featured?: boolean; sort_order?: number }) => {
      const { error } = await supabase.from("gallery_images").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gallery"] }),
  });
}

export function useDeleteGalleryImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gallery_images").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gallery"] }),
  });
}

// ─── REVIEWS (Testimonials) ────────────────────────────────────────────────
export function useReviews(featuredOnly = false) {
  return useQuery({
    queryKey: ["reviews", featuredOnly],
    queryFn: async () => {
      let q = supabase.from("reviews").select("*").order("created_at", { ascending: false });
      if (featuredOnly) q = q.eq("is_featured", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { author_name: string; rating: number; comment?: string; source?: string; is_featured?: boolean; is_approved?: boolean }) => {
      // Phase 5.5 — 2 reviews per name per day (public submissions).
      await enforceRateLimit({
        action: "review_create",
        identifier: input.author_name,
        max: 2,
        windowSeconds: 86400,
      });
      const { error } = await supabase.from("reviews").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
  });
}

export function useUpdateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; author_name?: string; rating?: number; comment?: string; source?: string; is_featured?: boolean; is_approved?: boolean }) => {
      const { error } = await supabase.from("reviews").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
  });
}

// ─── RESERVATION LEADS ─────────────────────────────────────────────────────
export function useReservations(opts?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ["reservations", opts],
    queryFn: async () => {
      let q = supabase.from("reservation_leads").select("*").order("created_at", { ascending: false });
      if (opts?.status && opts.status !== "all") q = q.eq("status", opts.status);
      if (opts?.search) q = q.or(`name.ilike.%${opts.search}%,phone.ilike.%${opts.search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; phone: string; email?: string; date?: string; time?: string; party_size?: number; notes?: string; source?: string }) => {
      // Phase 5.5 — 5 reservation attempts per phone/email per hour.
      await enforceRateLimit({
        action: "reservation_create",
        identifier: input.phone || input.email,
        max: 5,
        windowSeconds: 3600,
      });
      // Generate id client-side so we don't need SELECT permission to read
      // the inserted row back. Anonymous visitors can INSERT but not SELECT
      // reservation_leads (admin-only SELECT policy).
      const id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : undefined;
      const row = id ? { id, ...input } : input;
      const { error } = await supabase.from("reservation_leads").insert(row);
      if (error) throw error;
      // Phase 6.1 — fire confirmation email (no-op if customer didn't give email)
      if (id) {
        fireTransactionalEmail({ template: "reservation_confirmation", recordId: id });
        fireTransactionalSms({ template: "reservation_confirmation", recordId: id });
      }
      return { id } as { id: string | undefined };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });
}

export function useUpdateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status?: string; notes?: string }) => {
      const { error } = await supabase.from("reservation_leads").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });
}

export function useDeleteReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reservation_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });
}

// ─── CONTACT MESSAGES ──────────────────────────────────────────────────────
export function useContactMessages(opts?: { isRead?: boolean }) {
  return useQuery({
    queryKey: ["contactMessages", opts],
    queryFn: async () => {
      let q = supabase.from("contact_messages").select("*").order("created_at", { ascending: false });
      if (opts?.isRead !== undefined) q = q.eq("is_read", opts.isRead);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSubmitContact() {
  return useMutation({
    mutationFn: async (input: { name: string; phone: string; email?: string; inquiry_type?: string; message: string }) => {
      // Phase 5.5 — 3 contact submissions per email/phone per 10 minutes.
      await enforceRateLimit({
        action: "contact_submit",
        identifier: input.email || input.phone,
        max: 3,
        windowSeconds: 600,
      });
      // contact_messages.id is a serial (integer) with a sequence default —
      // do NOT generate it client-side. Insert and let the DB assign it.
      // Anon visitors can't SELECT the row back (admin-only), so the ack
      // email is fired by the admin/notification flow instead.
      const { error } = await supabase.from("contact_messages").insert(input);
      if (error) throw error;
    },
  });
}

export function useUpdateContactMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; is_read?: boolean; admin_notes?: string }) => {
      const { error } = await supabase.from("contact_messages").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contactMessages"] }),
  });
}

export function useDeleteContactMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contact_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contactMessages"] }),
  });
}

export function useUnreadMessageCount() {
  return useQuery({
    queryKey: ["unreadMessages"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("contact_messages")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30000,
  });
}

// ─── ORDERS ────────────────────────────────────────────────────────────────
export function useOrders(opts?: { status?: string; search?: string; includeUnpaid?: boolean }) {
  return useQuery({
    queryKey: ["orders", opts],
    queryFn: async () => {
      let q = supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (opts?.status) q = q.eq("status", opts.status);
      // Enforce "pay first": only orders with a successful payment reach the
      // admin panel. Pending, failed, cancelled and timed-out payments stay
      // hidden. Customers can still poll their own order via the tracking
      // page (useOrderByNumber) regardless of payment status.
      if (!opts?.includeUnpaid) q = q.eq("payment_status", "paid");
      if (opts?.search) q = q.or(`order_number.ilike.%${opts.search}%,customer_name.ilike.%${opts.search}%,customer_phone.ilike.%${opts.search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOrdersByPhone(phone: string) {
  return useQuery({
    queryKey: ["orders", "phone", phone],
    queryFn: async () => {
      // Match any common variant of a Kenyan phone number so a user who
      // searches "0712345678" still finds an order saved as "+254712345678"
      // or "254712345678".
      const digits = phone.replace(/\D/g, "");
      const variants = new Set<string>([phone, digits]);
      if (/^0[17]\d{8}$/.test(digits)) {
        variants.add("254" + digits.slice(1));
        variants.add("+254" + digits.slice(1));
      } else if (/^254[17]\d{8}$/.test(digits)) {
        variants.add("0" + digits.slice(3));
        variants.add("+" + digits);
      } else if (/^[17]\d{8}$/.test(digits)) {
        variants.add("0" + digits);
        variants.add("254" + digits);
        variants.add("+254" + digits);
      }
      const list = Array.from(variants).filter(Boolean);
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .in("customer_phone", list)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: phone.replace(/\D/g, "").length >= 9,
  });
}

export function useOrderByNumber(orderNumber: string) {
  return useQuery({
    queryKey: ["orders", "number", orderNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("order_number", orderNumber)
        .limit(1);
      if (error) throw error;
      return data ?? [];
    },
    enabled: orderNumber.length > 0,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      order_number: string;
      customer_name: string;
      customer_phone: string;
      customer_email?: string;
      items: any[];
      total_amount: number;
      order_type: string;
      delivery_address?: string;
      special_instructions?: string;
      estimated_time?: number;
      payment_method?: string;
    }) => {
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : undefined;
      const row = id ? { id, ...input } : input;
      const { data, error } = await supabase
        .from("orders")
        .insert(row)
        .select("id, order_number")
        .single();
      if (error) throw error;
      // Order confirmation email/SMS are sent after a successful M-Pesa payment
      // (see supabase/functions/mpesa-callback/index.ts), not at order creation.
      return {
        id: data?.id ?? id,
        order_number: data?.order_number ?? input.order_number,
      } as { id: string | undefined; order_number: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status?: string; payment_status?: string; estimated_time?: number; admin_notes?: string }) => {
      const { error } = await supabase.from("orders").update(data).eq("id", id);
      if (error) throw error;
      // Phase 6.1 — notify customer when admin moves the order to a meaningful status
      if (data.status && ["confirmed", "preparing", "ready", "completed", "cancelled"].includes(data.status)) {
        fireTransactionalEmail({ template: "order_status_update", recordId: id, status: data.status });
        fireTransactionalSms({ template: "order_status_update", recordId: id, status: data.status });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useOrderStats() {
  return useQuery({
    queryKey: ["orderStats"],
    queryFn: async () => {
      // Only count orders that have completed payment. Unpaid/pending-payment
      // rows are NOT surfaced to the admin panel — they only appear after the
      // M-Pesa callback (or a verified manual claim) flips payment_status to
      // anything other than "pending".
      const { data, error } = await supabase
        .from("orders")
        .select("status")
        .eq("payment_status", "paid");
      if (error) throw error;
      const all = data ?? [];
      return {
        total: all.length,
        pending: all.filter(o => o.status === "pending").length,
        preparing: all.filter(o => o.status === "preparing").length,
        outForDelivery: all.filter(o => o.status === "out-for-delivery").length,
      };
    },
  });
}

// ─── PAYMENT RECONCILIATION ────────────────────────────────────────────────
// Cross-checks the `payments` table against `orders` over a date window so
// admins can spot:
//   • paid orders with no successful M-Pesa payment row (manual / cash / data drift)
//   • successful payments with no matching paid order (orphans / refund needed)
//   • amount mismatches between order.total_amount and payment.amount
export interface ReconciliationDiscrepancy {
  kind: "missing-payment" | "orphan-payment" | "amount-mismatch";
  order_id?: string;
  order_number?: string | null;
  payment_id?: string;
  mpesa_receipt?: string | null;
  order_amount?: number;
  payment_amount?: number;
  created_at: string;
}
export interface ReconciliationResult {
  paidOrdersCount: number;
  paidOrdersTotal: number;
  successPaymentsCount: number;
  successPaymentsTotal: number;
  discrepancies: ReconciliationDiscrepancy[];
}

export function useReconciliation(sinceISO: string) {
  return useQuery<ReconciliationResult>({
    queryKey: ["reconciliation", sinceISO],
    queryFn: async () => {
      const [ordersRes, paymentsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, order_number, total_amount, payment_status, created_at")
          .eq("payment_status", "paid")
          .gte("created_at", sinceISO),
        (supabase as any)
          .from("payments")
          .select("id, order_id, amount, status, mpesa_receipt_number, created_at")
          .eq("status", "success")
          .gte("created_at", sinceISO),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const paidOrders = (ordersRes.data ?? []) as any[];
      const successPayments = (paymentsRes.data ?? []) as any[];

      const paymentsByOrder = new Map<string, any[]>();
      for (const p of successPayments) {
        const arr = paymentsByOrder.get(p.order_id) ?? [];
        arr.push(p);
        paymentsByOrder.set(p.order_id, arr);
      }
      const paidOrderIds = new Set(paidOrders.map((o) => o.id));

      const discrepancies: ReconciliationDiscrepancy[] = [];

      for (const o of paidOrders) {
        const ps = paymentsByOrder.get(o.id);
        if (!ps || ps.length === 0) {
          discrepancies.push({
            kind: "missing-payment",
            order_id: o.id,
            order_number: o.order_number,
            order_amount: Number(o.total_amount ?? 0),
            created_at: o.created_at,
          });
          continue;
        }
        const paidSum = ps.reduce((s, p) => s + Number(p.amount ?? 0), 0);
        const orderAmt = Math.round(Number(o.total_amount ?? 0));
        if (Math.abs(paidSum - orderAmt) > 0.5) {
          discrepancies.push({
            kind: "amount-mismatch",
            order_id: o.id,
            order_number: o.order_number,
            payment_id: ps[0].id,
            mpesa_receipt: ps[0].mpesa_receipt_number,
            order_amount: orderAmt,
            payment_amount: paidSum,
            created_at: o.created_at,
          });
        }
      }

      for (const p of successPayments) {
        if (!paidOrderIds.has(p.order_id)) {
          discrepancies.push({
            kind: "orphan-payment",
            payment_id: p.id,
            order_id: p.order_id,
            mpesa_receipt: p.mpesa_receipt_number,
            payment_amount: Number(p.amount ?? 0),
            created_at: p.created_at,
          });
        }
      }

      return {
        paidOrdersCount: paidOrders.length,
        paidOrdersTotal: paidOrders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0),
        successPaymentsCount: successPayments.length,
        successPaymentsTotal: successPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0),
        discrepancies: discrepancies.sort(
          (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
        ),
      };
    },
  });
}
export function useAdminDashboardStats() {
  return useQuery({
    queryKey: ["adminDashboard"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      const startISO = startOfToday.toISOString();
      const activeOrderStatuses = ["pending", "confirmed", "preparing", "ready", "out_for_delivery"];
      const [
        resToday, resPending, menuFeatured, gallery, events, unread,
        ordersToday, ordersActive, ordersRevenueToday,
        ordersPendingConfirm, ordersByStatus,
      ] = await Promise.all([
        supabase.from("reservation_leads").select("*", { count: "exact", head: true }).eq("date", today),
        supabase.from("reservation_leads").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("menu_items").select("*", { count: "exact", head: true }).eq("is_featured", true),
        supabase.from("gallery_images").select("*", { count: "exact", head: true }),
        supabase.from("events").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("contact_messages").select("*", { count: "exact", head: true }).eq("is_read", false),
        supabase.from("orders").select("*", { count: "exact", head: true })
          .eq("payment_status", "paid").gte("created_at", startISO),
        supabase.from("orders").select("*", { count: "exact", head: true })
          .eq("payment_status", "paid").in("status", activeOrderStatuses),
        supabase.from("orders").select("total_amount")
          .eq("payment_status", "paid").gte("created_at", startISO),
        supabase.from("orders").select("*", { count: "exact", head: true })
          .eq("payment_status", "paid").eq("status", "pending"),
        supabase.from("orders").select("status")
          .eq("payment_status", "paid").in("status", activeOrderStatuses),
      ]);
      const revenueToday = (ordersRevenueToday.data ?? []).reduce(
        (sum: number, r: any) => sum + Number(r.total_amount ?? 0), 0,
      );
      const statusBreakdown = (ordersByStatus.data ?? []).reduce(
        (acc: Record<string, number>, r: any) => {
          acc[r.status] = (acc[r.status] ?? 0) + 1;
          return acc;
        }, {},
      );
      return {
        reservationsToday: resToday.count ?? 0,
        pendingReservations: resPending.count ?? 0,
        featuredMenuItems: menuFeatured.count ?? 0,
        galleryCount: gallery.count ?? 0,
        activeEvents: events.count ?? 0,
        newMessages: unread.count ?? 0,
        ordersToday: ordersToday.count ?? 0,
        activeOrders: ordersActive.count ?? 0,
        ordersPendingConfirmation: ordersPendingConfirm.count ?? 0,
        ordersByStatus: statusBreakdown,
        revenueToday,
      };
    },
  });
}

export function useActivityLog() {
  return useQuery({
    queryKey: ["activityLog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["adminUsers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_profiles")
        .select("*, admin_roles(role)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        id: p.id,
        name: p.full_name,
        email: p.email,
        role: p.admin_roles?.[0]?.role ?? "user",
        createdAt: p.created_at,
        is_active: p.is_active,
      }));
    },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      // Delete existing role and insert new one
      await supabase.from("admin_roles").delete().eq("user_id", userId);
      if (role !== "user") {
        const { error } = await supabase.from("admin_roles").insert({ user_id: userId, role: role as any });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminUsers"] }),
  });
}

// Phase 5.4 — Admin / self account deletion via the `admin-delete-user`
// edge function. The function verifies the caller's JWT and enforces:
//   * self-delete is always allowed for the signed-in user
//   * deleting someone else requires admin/super_admin role
//   * cannot delete the last remaining admin
export function useDeleteAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data, error } = await supabase.functions.invoke<{ ok: true; deletedId: string; self: boolean }>(
        "admin-delete-user",
        { body: { userId } },
      );
      if (error) throw new Error(error.message ?? "Failed to delete account");
      if (!data?.ok) throw new Error("Delete returned no confirmation");
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminUsers"] }),
  });
}

// ─── PAYMENTS PER ORDER + REFUNDS (Phase 7.5) ─────────────────────────────
export interface OrderPayment {
  id: string;
  order_id: string | null;
  reservation_id: string | null;
  amount: number;
  status: string;
  mpesa_receipt_number: string | null;
  refund_status: "none" | "pending" | "refunded" | "failed";
  refund_amount: number | null;
  refund_reason: string | null;
  refund_result_desc: string | null;
  refunded_at: string | null;
  created_at: string;
  manual_claim_status: "none" | "claimed" | "verified" | "rejected";
  manual_reference: string | null;
  manual_claimed_at: string | null;
}

const ORDER_PAYMENT_COLUMNS =
  "id, order_id, reservation_id, amount, status, mpesa_receipt_number, refund_status, refund_amount, refund_reason, refund_result_desc, refunded_at, created_at, manual_claim_status, manual_reference, manual_claimed_at";

export function useOrderPayments(orderId: string | null | undefined) {
  return useQuery<OrderPayment[]>({
    queryKey: ["orderPayments", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payments")
        .select(ORDER_PAYMENT_COLUMNS)
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderPayment[];
    },
  });
}

/** Admin: payments awaiting manual M-Pesa verification (polled every 15s). */
export function usePendingManualClaims() {
  return useQuery<any[]>({
    queryKey: ["manualClaims", "pending"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payments")
        .select(`${ORDER_PAYMENT_COLUMNS}, orders:order_id (order_number, customer_name, customer_phone)`)
        .eq("manual_claim_status", "claimed")
        .order("manual_claimed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 15_000,
  });
}

// Daraja Reversal API. Calls the `mpesa-reversal` edge function which
// requires admin auth; on success the refund_status flips to 'pending' and
// the async result callback flips it to 'refunded' or 'failed'.
export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { paymentId: string; amount?: number; reason?: string },
    ) => {
      const { data, error } = await supabase.functions.invoke<{
        ok: true;
        paymentId: string;
        conversationId?: string;
      }>("mpesa-reversal", { body: input });
      if (error) throw new Error(error.message ?? "Refund request failed");
      if (!data?.ok) throw new Error("Refund returned no confirmation");
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["orderPayments"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["reconciliation"] });
    },
  });
}


// ── Customer-facing: orders that belong to the signed-in user ─────────────
// RLS (orders_owner_read) lets authenticated users see rows where
// user_id = auth.uid() OR customer_email matches their auth email. The query
// here just selects from the table — Postgres filters via the policy.
export function useMyOrders(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["orders", "mine", userId ?? "anon"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });
}
