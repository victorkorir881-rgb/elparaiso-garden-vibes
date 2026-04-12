import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: localStorage, persistSession: true, autoRefreshToken: true },
});
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── SITE SETTINGS ─────────────────────────────────────────────────────────
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
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
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from("site_settings")
          .upsert({ key, value, category: "general" }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
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
      const { data, error } = await supabase.from("reservation_leads").insert(input).select().single();
      if (error) throw error;
      return data;
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
export function useOrders(opts?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ["orders", opts],
    queryFn: async () => {
      let q = supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (opts?.status) q = q.eq("status", opts.status);
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
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_phone", phone)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: phone.length > 0,
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
      const { data, error } = await supabase.from("orders").insert(input).select().single();
      if (error) throw error;
      return data;
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
      const { data, error } = await supabase.from("orders").select("status");
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

// ─── ADMIN ─────────────────────────────────────────────────────────────────
export function useAdminDashboardStats() {
  return useQuery({
    queryKey: ["adminDashboard"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const [resToday, resPending, menuFeatured, gallery, events, unread] = await Promise.all([
        supabase.from("reservation_leads").select("*", { count: "exact", head: true }).eq("date", today),
        supabase.from("reservation_leads").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("menu_items").select("*", { count: "exact", head: true }).eq("is_featured", true),
        supabase.from("gallery_images").select("*", { count: "exact", head: true }),
        supabase.from("events").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("contact_messages").select("*", { count: "exact", head: true }).eq("is_read", false),
      ]);
      return {
        reservationsToday: resToday.count ?? 0,
        pendingReservations: resPending.count ?? 0,
        featuredMenuItems: menuFeatured.count ?? 0,
        galleryCount: gallery.count ?? 0,
        activeEvents: events.count ?? 0,
        newMessages: unread.count ?? 0,
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
