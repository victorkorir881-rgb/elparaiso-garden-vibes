import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";
import {
  createContactMessage,
  createEvent,
  createGalleryImage,
  createMenuItem,
  createMenuCategory,
  createOrder,
  createPayment,
  createReservation,
  createTestimonial,
  deleteContactMessage,
  deleteEvent,
  deleteGalleryImage,
  deleteMenuItem,
  deleteMenuCategory,
  deleteOrder,
  deleteReservation,
  deleteTestimonial,
  getActivityLogs,
  getAllAdminUsers,
  getAllOrders,
  getContactMessages,
  getDashboardStats,
  getEvents,
  getGalleryImages,
  getMenuCategories,
  getMenuItems,
  getOrderByNumber,
  getOrdersByPhone,
  getOrderStats,
  getAllPayments,
  getPaymentById,
  getPaymentByFlutterwaveRef,
  getPaymentsByOrderId,
  getPaymentsByReservationId,
  updatePaymentStatus,
  getReservations,
  getSeoSettings,
  getSeoSettingByPage,
  getSiteSettings,
  getTestimonials,
  getUnreadMessageCount,
  logActivity,
  updateContactMessage,
  updateEvent,
  updateGalleryImage,
  updateMenuItem,
  updateMenuCategory,
  updateOrder,
  updateReservation,
  updateTestimonial,
  updateUserRole,
  upsertSeoSetting,
  upsertSiteSettings,
} from "./db";

// ─── Admin guard middleware ────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["admin", "manager"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

const managerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["admin", "manager"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Manager access required" });
  }
  return next({ ctx });
});

const editorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["admin", "manager", "editor"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Editor access required" });
  }
  return next({ ctx });
});

const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Super admin access required" });
  }
  return next({ ctx });
});

// ─── File upload helper ───────────────────────────────────────────────────────
function randomSuffix() {
  return Math.random().toString(36).substring(2, 10);
}

async function uploadBase64Image(base64: string, folder: string, mimeType = "image/jpeg"): Promise<{ url: string; key: string }> {
  const base64Data = base64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const ext = mimeType.split("/")[1] ?? "jpg";
  const key = `${folder}/${Date.now()}-${randomSuffix()}.${ext}`;
  const { url } = await storagePut(key, buffer, mimeType);
  return { url, key };
}

export const appRouter = router({
  system: systemRouter,

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── SITE SETTINGS ─────────────────────────────────────────────────────────
  settings: router({
    get: publicProcedure.query(() => getSiteSettings()),
    update: editorProcedure
      .input(z.record(z.string(), z.string()))
      .mutation(async ({ input, ctx }) => {
        await upsertSiteSettings(input);
        await logActivity(ctx.user.id, "Updated site settings");
        return { success: true };
      }),
  }),

  // ─── SEO SETTINGS ──────────────────────────────────────────────────────────
  seo: router({
    getAll: publicProcedure.query(() => getSeoSettings()),
    getByPage: publicProcedure.input(z.object({ page: z.string() })).query(({ input }) => getSeoSettingByPage(input.page)),
    update: editorProcedure
      .input(z.object({
        page: z.string(),
        seoTitle: z.string().optional(),
        metaDescription: z.string().optional(),
        ogTitle: z.string().optional(),
        ogDescription: z.string().optional(),
        ogImage: z.string().optional(),
        canonicalUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { page, ...data } = input;
        await upsertSeoSetting(page, data);
        await logActivity(ctx.user.id, `Updated SEO for page: ${page}`);
        return { success: true };
      }),
  }),

  // ─── MENU CATEGORIES ───────────────────────────────────────────────────────
  menuCategories: router({
    list: publicProcedure.input(z.object({ activeOnly: z.boolean().optional() })).query(({ input }) => getMenuCategories(input.activeOnly)),
    create: editorProcedure
      .input(z.object({ name: z.string().min(1), slug: z.string().min(1), description: z.string().optional(), sortOrder: z.number().optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        await createMenuCategory(input);
        await logActivity(ctx.user.id, `Created menu category: ${input.name}`, "menu_categories");
        return { success: true };
      }),
    update: editorProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), slug: z.string().optional(), description: z.string().optional(), sortOrder: z.number().optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await updateMenuCategory(id, data);
        await logActivity(ctx.user.id, `Updated menu category ${id}`, "menu_categories", id);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteMenuCategory(input.id);
        await logActivity(ctx.user.id, `Deleted menu category ${input.id}`, "menu_categories", input.id);
        return { success: true };
      }),
  }),

  // ─── MENU ITEMS ────────────────────────────────────────────────────────────
  menuItems: router({
    list: publicProcedure
      .input(z.object({ categoryId: z.number().optional(), featuredOnly: z.boolean().optional(), availableOnly: z.boolean().optional(), search: z.string().optional() }))
      .query(({ input }) => getMenuItems(input)),
    create: editorProcedure
      .input(z.object({
        categoryId: z.number(),
        name: z.string().min(1),
        slug: z.string().optional(),
        description: z.string().optional(),
        price: z.string(),
        imageBase64: z.string().optional(),
        imageMime: z.string().optional(),
        isAvailable: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        badge: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        let imageUrl: string | undefined;
        let imageKey: string | undefined;
        if (input.imageBase64) {
          const uploaded = await uploadBase64Image(input.imageBase64, "menu", input.imageMime ?? "image/jpeg");
          imageUrl = uploaded.url;
          imageKey = uploaded.key;
        }
        await createMenuItem({ ...input, imageUrl, imageKey });
        await logActivity(ctx.user.id, `Created menu item: ${input.name}`, "menu_items");
        return { success: true };
      }),
    update: editorProcedure
      .input(z.object({
        id: z.number(),
        categoryId: z.number().optional(),
        name: z.string().optional(),
        slug: z.string().optional(),
        description: z.string().optional(),
        price: z.string().optional(),
        imageBase64: z.string().optional(),
        imageMime: z.string().optional(),
        isAvailable: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        badge: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, imageBase64, imageMime, ...data } = input;
        let imageUrl: string | undefined;
        let imageKey: string | undefined;
        if (imageBase64) {
          const uploaded = await uploadBase64Image(imageBase64, "menu", imageMime ?? "image/jpeg");
          imageUrl = uploaded.url;
          imageKey = uploaded.key;
        }
        await updateMenuItem(id, { ...data, ...(imageUrl ? { imageUrl, imageKey } : {}) });
        await logActivity(ctx.user.id, `Updated menu item ${id}`, "menu_items", id);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteMenuItem(input.id);
        await logActivity(ctx.user.id, `Deleted menu item ${input.id}`, "menu_items", input.id);
        return { success: true };
      }),
    toggleFeatured: editorProcedure
      .input(z.object({ id: z.number(), isFeatured: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await updateMenuItem(input.id, { isFeatured: input.isFeatured });
        return { success: true };
      }),
    toggleAvailability: editorProcedure
      .input(z.object({ id: z.number(), isAvailable: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        await updateMenuItem(input.id, { isAvailable: input.isAvailable });
        return { success: true };
      }),
  }),

  // ─── RESERVATIONS ──────────────────────────────────────────────────────────
  reservations: router({
    create: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email().optional().or(z.literal("")),
        date: z.string().min(1),
        time: z.string().min(1),
        guests: z.number().min(1).max(100),
        specialRequest: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const reservation = await createReservation({ ...input, status: "pending" });
        // Notify owner
        try {
          await notifyOwner({
            title: `New Reservation: ${input.name}`,
            content: `${input.name} (${input.phone}) has booked a table for ${input.guests} guests on ${input.date} at ${input.time}. ${input.specialRequest ? `Note: ${input.specialRequest}` : ""}`,
          });
        } catch {}
        return { success: true, reservation };
      }),
    list: adminProcedure
      .input(z.object({ status: z.string().optional(), search: z.string().optional(), date: z.string().optional() }))
      .query(({ input }) => getReservations(input)),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "confirmed", "cancelled", "completed"]).optional(),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await updateReservation(id, data);
        await logActivity(ctx.user.id, `Updated reservation ${id} status: ${data.status}`, "reservations", id);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteReservation(input.id);
        await logActivity(ctx.user.id, `Deleted reservation ${input.id}`, "reservations", input.id);
        return { success: true };
      }),
    stats: adminProcedure.query(() => {
      const { getReservationStats } = require("./db");
      return getReservationStats();
    }),
  }),

  // ─── EVENTS ────────────────────────────────────────────────────────────────
  events: router({
    list: publicProcedure
      .input(z.object({ activeOnly: z.boolean().optional(), homepageOnly: z.boolean().optional() }))
      .query(({ input }) => getEvents(input)),
    create: editorProcedure
      .input(z.object({
        title: z.string().min(1),
        subtitle: z.string().optional(),
        description: z.string().optional(),
        eventDate: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        imageBase64: z.string().optional(),
        imageMime: z.string().optional(),
        ctaLabel: z.string().optional(),
        ctaUrl: z.string().optional(),
        isActive: z.boolean().optional(),
        showOnHomepage: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { imageBase64, imageMime, ...data } = input;
        let imageUrl: string | undefined;
        let imageKey: string | undefined;
        if (imageBase64) {
          const uploaded = await uploadBase64Image(imageBase64, "events", imageMime ?? "image/jpeg");
          imageUrl = uploaded.url;
          imageKey = uploaded.key;
        }
        await createEvent({ ...data, imageUrl, imageKey });
        await logActivity(ctx.user.id, `Created event: ${input.title}`, "events");
        return { success: true };
      }),
    update: editorProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        subtitle: z.string().optional(),
        description: z.string().optional(),
        eventDate: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        imageBase64: z.string().optional(),
        imageMime: z.string().optional(),
        ctaLabel: z.string().optional(),
        ctaUrl: z.string().optional(),
        isActive: z.boolean().optional(),
        showOnHomepage: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, imageBase64, imageMime, ...data } = input;
        let imageUrl: string | undefined;
        let imageKey: string | undefined;
        if (imageBase64) {
          const uploaded = await uploadBase64Image(imageBase64, "events", imageMime ?? "image/jpeg");
          imageUrl = uploaded.url;
          imageKey = uploaded.key;
        }
        await updateEvent(id, { ...data, ...(imageUrl ? { imageUrl, imageKey } : {}) });
        await logActivity(ctx.user.id, `Updated event ${id}`, "events", id);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteEvent(input.id);
        await logActivity(ctx.user.id, `Deleted event ${input.id}`, "events", input.id);
        return { success: true };
      }),
  }),

  // ─── GALLERY ───────────────────────────────────────────────────────────────
  gallery: router({
    list: publicProcedure
      .input(z.object({ category: z.string().optional(), featuredOnly: z.boolean().optional() }))
      .query(({ input }) => getGalleryImages(input)),
    upload: editorProcedure
      .input(z.object({
        imageBase64: z.string(),
        imageMime: z.string().optional(),
        category: z.string().default("General"),
        altText: z.string().optional(),
        isFeatured: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { imageBase64, imageMime, ...data } = input;
        const { url, key } = await uploadBase64Image(imageBase64, "gallery", imageMime ?? "image/jpeg");
        await createGalleryImage({ ...data, imageUrl: url, imageKey: key });
        await logActivity(ctx.user.id, "Uploaded gallery image", "gallery_images");
        return { success: true };
      }),
    update: editorProcedure
      .input(z.object({ id: z.number(), category: z.string().optional(), altText: z.string().optional(), isFeatured: z.boolean().optional(), sortOrder: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await updateGalleryImage(id, data);
        return { success: true };
      }),
    delete: editorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteGalleryImage(input.id);
        await logActivity(ctx.user.id, `Deleted gallery image ${input.id}`, "gallery_images", input.id);
        return { success: true };
      }),
  }),

  // ─── TESTIMONIALS ──────────────────────────────────────────────────────────
  testimonials: router({
    list: publicProcedure.input(z.object({ featuredOnly: z.boolean().optional() })).query(({ input }) => getTestimonials(input.featuredOnly)),
    create: editorProcedure
      .input(z.object({ reviewerName: z.string().min(1), rating: z.number().min(1).max(5), reviewText: z.string().min(1), sourceLabel: z.string().optional(), isFeatured: z.boolean().optional(), sortOrder: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        await createTestimonial(input);
        await logActivity(ctx.user.id, `Added testimonial from ${input.reviewerName}`, "testimonials");
        return { success: true };
      }),
    update: editorProcedure
      .input(z.object({ id: z.number(), reviewerName: z.string().optional(), rating: z.number().optional(), reviewText: z.string().optional(), sourceLabel: z.string().optional(), isFeatured: z.boolean().optional(), sortOrder: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await updateTestimonial(id, data);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteTestimonial(input.id);
        return { success: true };
      }),
  }),

  // ─── CONTACT MESSAGES ──────────────────────────────────────────────────────
  contact: router({
    submit: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email().optional().or(z.literal("")),
        inquiryType: z.string().default("General Inquiry"),
        message: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const msg = await createContactMessage(input);
        try {
          await notifyOwner({
            title: `New ${input.inquiryType}: ${input.name}`,
            content: `From: ${input.name} (${input.phone})\nType: ${input.inquiryType}\n\n${input.message}`,
          });
        } catch {}
        return { success: true };
      }),
    list: adminProcedure
      .input(z.object({ isRead: z.boolean().optional(), inquiryType: z.string().optional() }))
      .query(({ input }) => getContactMessages(input)),
    markRead: adminProcedure
      .input(z.object({ id: z.number(), isRead: z.boolean() }))
      .mutation(async ({ input }) => {
        await updateContactMessage(input.id, { isRead: input.isRead });
        return { success: true };
      }),
    addNote: adminProcedure
      .input(z.object({ id: z.number(), adminNotes: z.string() }))
      .mutation(async ({ input }) => {
        await updateContactMessage(input.id, { adminNotes: input.adminNotes });
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteContactMessage(input.id);
        return { success: true };
      }),
    unreadCount: adminProcedure.query(() => getUnreadMessageCount()),
  }),
  // ─── ORDERS ───────────────────────────────────────────────────────────────────
  orders: router({
    trackByPhone: publicProcedure
      .input(z.object({ phone: z.string().min(1) }))
      .query(({ input }) => getOrdersByPhone(input.phone)),
    trackByNumber: publicProcedure
      .input(z.object({ orderNumber: z.string().min(1) }))
      .query(({ input }) => getOrderByNumber(input.orderNumber)),
    create: publicProcedure
      .input(z.object({
        customerName: z.string().min(1),
        customerPhone: z.string().min(1),
        customerEmail: z.string().email().optional().or(z.literal("")),
        items: z.array(z.object({ id: z.number(), name: z.string(), price: z.string(), quantity: z.number() })),
        totalAmount: z.string(),
        orderType: z.enum(["dine-in", "takeaway", "delivery"]),
        deliveryAddress: z.string().optional(),
        specialInstructions: z.string().optional(),
        estimatedTime: z.number().optional(),
        paymentMethod: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const orderNumber = `ORD-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        const order = {
          ...input,
          orderNumber,
          items: JSON.stringify(input.items),
          paymentStatus: "pending" as const,
          status: "pending" as const,
        };
        await createOrder(order as any);
        try {
          await notifyOwner({
            title: `New Order: ${orderNumber}`,
            content: `${input.customerName} (${input.customerPhone}) placed a ${input.orderType} order for ${input.totalAmount}. ${input.deliveryAddress ? `Delivery to: ${input.deliveryAddress}` : ""}`,
          });
        } catch {}
        return { success: true, orderNumber };
      }),
    list: managerProcedure
      .input(z.object({ status: z.string().optional(), orderType: z.string().optional(), search: z.string().optional() }))
      .query(({ input }) => getAllOrders(input)),
    update: managerProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "confirmed", "preparing", "ready", "out-for-delivery", "completed", "cancelled"]).optional(),
        paymentStatus: z.enum(["pending", "paid", "failed"]).optional(),
        estimatedTime: z.number().optional(),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await updateOrder(id, data as any);
        await logActivity(ctx.user.id, `Updated order ${id} status: ${data.status}`, "orders", id);
        return { success: true };
      }),
    delete: managerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deleteOrder(input.id);
        await logActivity(ctx.user.id, `Deleted order ${input.id}`, "orders", input.id);
        return { success: true };
      }),
    stats: managerProcedure.query(() => getOrderStats()),
  }),

  // ─── ADMIN ───────────────────────────────────────────────────────────────────
  admin: router({    dashboard: adminProcedure.query(() => getDashboardStats()),
    activityLog: adminProcedure.query(() => getActivityLogs(50)),
    users: superAdminProcedure.query(() => getAllAdminUsers()),
    updateUserRole: superAdminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "manager", "editor"]) }))
      .mutation(async ({ input, ctx }) => {
        await updateUserRole(input.userId, input.role);
        await logActivity(ctx.user.id, `Changed user ${input.userId} role to ${input.role}`, "users", input.userId);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
