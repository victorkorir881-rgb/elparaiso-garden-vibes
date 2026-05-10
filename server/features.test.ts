import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock the DB helpers ──────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getAllAdminUsers: vi.fn().mockResolvedValue([]),
  updateUserRole: vi.fn().mockResolvedValue(undefined),
  getSiteSettings: vi.fn().mockResolvedValue({ siteName: "Elparaiso Garden", phone: "0791224513" }),
  upsertSiteSetting: vi.fn().mockResolvedValue(undefined),
  upsertSiteSettings: vi.fn().mockResolvedValue(undefined),
  getSeoSettings: vi.fn().mockResolvedValue([]),
  getSeoSettingByPage: vi.fn().mockResolvedValue({
    id: 1, page: "home", seoTitle: "Elparaiso Garden", metaDescription: "Test",
    ogTitle: null, ogDescription: null, ogImage: null, canonicalUrl: null, updatedAt: new Date(),
  }),
  upsertSeoSetting: vi.fn().mockResolvedValue(undefined),
  getMenuCategories: vi.fn().mockResolvedValue([
    { id: 1, name: "Grills", slug: "grills", description: null, sortOrder: 0, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ]),
  createMenuCategory: vi.fn().mockResolvedValue({ id: 2, name: "Drinks", slug: "drinks", description: null, sortOrder: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() }),
  updateMenuCategory: vi.fn().mockResolvedValue(undefined),
  deleteMenuCategory: vi.fn().mockResolvedValue(undefined),
  getMenuItems: vi.fn().mockResolvedValue([
    { id: 1, categoryId: 1, name: "Nyama Choma", description: "Grilled meat", price: "550.00", imageUrl: null, imageKey: null, isAvailable: true, isFeatured: true, isVegetarian: false, isSpicy: false, tags: null, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() },
  ]),
  getMenuItemById: vi.fn().mockResolvedValue(null),
  createMenuItem: vi.fn().mockResolvedValue(undefined),
  updateMenuItem: vi.fn().mockResolvedValue(undefined),
  deleteMenuItem: vi.fn().mockResolvedValue(undefined),
  getReservations: vi.fn().mockResolvedValue([
    { id: 1, name: "John Doe", phone: "0712345678", email: null, date: "2026-04-10", time: "19:00", guests: 4, specialRequest: null, status: "pending", adminNotes: null, createdAt: new Date(), updatedAt: new Date() },
  ]),
  createReservation: vi.fn().mockResolvedValue({
    id: 2, name: "Jane Doe", phone: "0798765432", email: "jane@example.com",
    date: "2026-04-15", time: "20:00", guests: 2, specialRequest: "Window seat",
    status: "pending", adminNotes: null, createdAt: new Date(), updatedAt: new Date(),
  }),
  updateReservation: vi.fn().mockResolvedValue(undefined),
  deleteReservation: vi.fn().mockResolvedValue(undefined),
  getReservationStats: vi.fn().mockResolvedValue({ total: 0, pending: 0, confirmed: 0, cancelled: 0, completed: 0 }),
  getEvents: vi.fn().mockResolvedValue([]),
  createEvent: vi.fn().mockResolvedValue(undefined),
  updateEvent: vi.fn().mockResolvedValue(undefined),
  deleteEvent: vi.fn().mockResolvedValue(undefined),
  getGalleryImages: vi.fn().mockResolvedValue([]),
  createGalleryImage: vi.fn().mockResolvedValue(undefined),
  updateGalleryImage: vi.fn().mockResolvedValue(undefined),
  deleteGalleryImage: vi.fn().mockResolvedValue(undefined),
  getGalleryCount: vi.fn().mockResolvedValue(0),
  getTestimonials: vi.fn().mockResolvedValue([]),
  createTestimonial: vi.fn().mockResolvedValue(undefined),
  updateTestimonial: vi.fn().mockResolvedValue(undefined),
  deleteTestimonial: vi.fn().mockResolvedValue(undefined),
  createContactMessage: vi.fn().mockResolvedValue({
    id: 1, name: "Test User", phone: "0700000000", email: null,
    inquiryType: "General Inquiry", message: "Hello", isRead: false,
    adminNotes: null, createdAt: new Date(), updatedAt: new Date(),
  }),
  getContactMessages: vi.fn().mockResolvedValue([]),
  updateContactMessage: vi.fn().mockResolvedValue(undefined),
  deleteContactMessage: vi.fn().mockResolvedValue(undefined),
  getUnreadMessageCount: vi.fn().mockResolvedValue(0),
  logActivity: vi.fn().mockResolvedValue(undefined),
  getActivityLogs: vi.fn().mockResolvedValue([]),
  getDashboardStats: vi.fn().mockResolvedValue({
    reservationsToday: 0, pendingReservations: 1, newMessages: 0,
    activeEvents: 0, featuredMenuItems: 1, galleryCount: 0,
  }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "test.jpg", url: "https://cdn.example.com/test.jpg" }),
  storageDelete: vi.fn().mockResolvedValue(undefined),
}));

// ─── Context helpers ──────────────────────────────────────────────────────────
function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makeAdminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-open-id",
      email: "admin@elparaiso.co.ke",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user object for authenticated users", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.role).toBe("admin");
  });
});

describe("menuCategories.list", () => {
  it("returns menu categories for public users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.menuCategories.list({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("slug");
  });
});

describe("menuItems.list", () => {
  it("returns menu items for public users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.menuItems.list({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("price");
  });

  it("filters by categoryId when provided", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.menuItems.list({ categoryId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("reservations.create", () => {
  it("creates a reservation and returns success", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.reservations.create({
      name: "Jane Doe",
      phone: "0798765432",
      email: "jane@example.com",
      date: "2026-04-15",
      time: "20:00",
      guests: 2,
      specialRequest: "Window seat",
    });
    // reservations.create returns { success: true, reservation }
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("reservation");
    expect(result.reservation).toHaveProperty("id");
    expect(result.reservation.status).toBe("pending");
  });

  it("rejects reservation with empty name", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(
      caller.reservations.create({
        name: "",
        phone: "0798765432",
        date: "2026-04-15",
        time: "20:00",
        guests: 2,
      })
    ).rejects.toThrow();
  });

  it("rejects reservation with empty phone", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(
      caller.reservations.create({
        name: "Jane Doe",
        phone: "",
        date: "2026-04-15",
        time: "20:00",
        guests: 2,
      })
    ).rejects.toThrow();
  });
});

describe("reservations.list (admin only)", () => {
  it("returns reservations for admin users", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.reservations.list({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("throws UNAUTHORIZED for public users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.reservations.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("contact.submit", () => {
  it("creates a contact message and returns success", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.contact.submit({
      name: "Test User",
      phone: "0700000000",
      inquiryType: "General Inquiry",
      message: "Hello, I have a question.",
    });
    expect(result).toHaveProperty("success", true);
  });

  it("rejects message with empty name", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(
      caller.contact.submit({
        name: "",
        phone: "0700000000",
        inquiryType: "General Inquiry",
        message: "Hello",
      })
    ).rejects.toThrow();
  });

  it("rejects message with empty message body", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(
      caller.contact.submit({
        name: "Test User",
        phone: "0700000000",
        inquiryType: "General Inquiry",
        message: "",
      })
    ).rejects.toThrow();
  });
});

describe("settings.get", () => {
  it("returns site settings for public users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.settings.get();
    expect(result).toHaveProperty("siteName");
    expect(result).toHaveProperty("phone");
  });
});

describe("admin.dashboard (admin only)", () => {
  it("returns dashboard stats for admin", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.admin.dashboard();
    expect(result).toHaveProperty("reservationsToday");
    expect(result).toHaveProperty("pendingReservations");
    expect(result).toHaveProperty("newMessages");
    expect(result).toHaveProperty("activeEvents");
    expect(result).toHaveProperty("featuredMenuItems");
    expect(result).toHaveProperty("galleryCount");
  });

  it("throws UNAUTHORIZED for public users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.admin.dashboard()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("seo.getByPage", () => {
  it("returns SEO data for a given page", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.seo.getByPage({ page: "home" });
    expect(result).not.toBeNull();
    if (result) {
      expect(result.page).toBe("home");
      expect(result).toHaveProperty("seoTitle");
    }
  });
});

describe("events.list", () => {
  it("returns events for public users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.events.list({});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("gallery.list", () => {
  it("returns gallery images for public users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.gallery.list({});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("testimonials.list", () => {
  it("returns testimonials for public users", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.testimonials.list({});
    expect(Array.isArray(result)).toBe(true);
  });
});
