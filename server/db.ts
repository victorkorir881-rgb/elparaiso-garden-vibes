import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activityLogs,
  contactMessages,
  events,
  galleryImages,
  InsertContactMessage,
  InsertEvent,
  InsertGalleryImage,
  InsertMenuItem,
  InsertMenuCategory,
  InsertOrder,
  InsertPayment,
  InsertReservation,
  InsertTestimonial,
  InsertUser,
  menuCategories,
  menuItems,
  orders,
  Payment,
  payments,
  reservations,
  seoSettings,
  siteSettings,
  testimonials,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── USERS ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getAllAdminUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(or(eq(users.role, "admin"), eq(users.role, "manager"), eq(users.role, "editor"))).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "user" | "admin" | "manager" | "editor") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
}

// ─── SITE SETTINGS ────────────────────────────────────────────────────────────
export async function getSiteSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(siteSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
}

export async function upsertSiteSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(siteSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value, updatedAt: new Date() } });
}

export async function upsertSiteSettings(settings: Record<string, string>) {
  const db = await getDb();
  if (!db) return;
  for (const [key, value] of Object.entries(settings)) {
    await db.insert(siteSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value, updatedAt: new Date() } });
  }
}

// ─── SEO SETTINGS ─────────────────────────────────────────────────────────────
export async function getSeoSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(seoSettings).orderBy(seoSettings.page);
}

export async function getSeoSettingByPage(page: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(seoSettings).where(eq(seoSettings.page, page)).limit(1);
  return result[0] ?? null;
}

export async function upsertSeoSetting(page: string, data: Partial<typeof seoSettings.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.insert(seoSettings).values({ page, ...data }).onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
}

// ─── MENU CATEGORIES ──────────────────────────────────────────────────────────
export async function getMenuCategories(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(menuCategories);
  if (activeOnly) return query.where(eq(menuCategories.isActive, true)).orderBy(menuCategories.sortOrder);
  return query.orderBy(menuCategories.sortOrder);
}

export async function createMenuCategory(data: InsertMenuCategory) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(menuCategories).values(data);
  return result[0];
}

export async function updateMenuCategory(id: number, data: Partial<InsertMenuCategory>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(menuCategories).set({ ...data, updatedAt: new Date() }).where(eq(menuCategories.id, id));
}

export async function deleteMenuCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(menuCategories).where(eq(menuCategories.id, id));
}

// ─── MENU ITEMS ───────────────────────────────────────────────────────────────
export async function getMenuItems(opts?: { categoryId?: number; featuredOnly?: boolean; availableOnly?: boolean; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(menuItems);
  const conditions = [];
  if (opts?.categoryId) conditions.push(eq(menuItems.categoryId, opts.categoryId));
  if (opts?.featuredOnly) conditions.push(eq(menuItems.isFeatured, true));
  if (opts?.availableOnly) conditions.push(eq(menuItems.isAvailable, true));
  if (opts?.search) conditions.push(like(menuItems.name, `%${opts.search}%`));
  if (conditions.length > 0) query = query.where(and(...conditions)) as typeof query;
  return query.orderBy(menuItems.sortOrder, menuItems.name);
}

export async function getMenuItemById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createMenuItem(data: InsertMenuItem) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(menuItems).values(data);
}

export async function updateMenuItem(id: number, data: Partial<InsertMenuItem>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(menuItems).set({ ...data, updatedAt: new Date() }).where(eq(menuItems.id, id));
}

export async function deleteMenuItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(menuItems).where(eq(menuItems.id, id));
}

// ─── RESERVATIONS ─────────────────────────────────────────────────────────────
export async function createReservation(data: InsertReservation) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(reservations).values(data);
  const id = (result as any)[0]?.insertId ?? null;
  if (id) {
    const rows = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
    return rows[0];
  }
  return null;
}

export async function getReservations(opts?: { status?: string; search?: string; date?: string }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(reservations);
  const conditions = [];
  if (opts?.status && opts.status !== "all") conditions.push(eq(reservations.status, opts.status as any));
  if (opts?.date) conditions.push(eq(reservations.date, opts.date));
  if (opts?.search) {
    conditions.push(or(like(reservations.name, `%${opts.search}%`), like(reservations.phone, `%${opts.search}%`)));
  }
  if (conditions.length > 0) query = query.where(and(...conditions)) as typeof query;
  return query.orderBy(desc(reservations.createdAt));
}

export async function updateReservation(id: number, data: Partial<InsertReservation>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(reservations).set({ ...data, updatedAt: new Date() }).where(eq(reservations.id, id));
}

export async function deleteReservation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(reservations).where(eq(reservations.id, id));
}

export async function getReservationStats() {
  const db = await getDb();
  if (!db) return { today: 0, pending: 0, confirmed: 0 };
  const today = new Date().toISOString().split("T")[0];
  const [todayRows, pendingRows, confirmedRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(reservations).where(eq(reservations.date, today)),
    db.select({ count: sql<number>`count(*)` }).from(reservations).where(eq(reservations.status, "pending")),
    db.select({ count: sql<number>`count(*)` }).from(reservations).where(eq(reservations.status, "confirmed")),
  ]);
  return {
    today: Number(todayRows[0]?.count ?? 0),
    pending: Number(pendingRows[0]?.count ?? 0),
    confirmed: Number(confirmedRows[0]?.count ?? 0),
  };
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────
export async function getEvents(opts?: { activeOnly?: boolean; homepageOnly?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(events);
  const conditions = [];
  if (opts?.activeOnly) conditions.push(eq(events.isActive, true));
  if (opts?.homepageOnly) conditions.push(eq(events.showOnHomepage, true));
  if (conditions.length > 0) query = query.where(and(...conditions)) as typeof query;
  return query.orderBy(events.sortOrder, desc(events.createdAt));
}

export async function createEvent(data: InsertEvent) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(events).values(data);
}

export async function updateEvent(id: number, data: Partial<InsertEvent>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(events).set({ ...data, updatedAt: new Date() }).where(eq(events.id, id));
}

export async function deleteEvent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(events).where(eq(events.id, id));
}

// ─── GALLERY ──────────────────────────────────────────────────────────────────
export async function getGalleryImages(opts?: { category?: string; featuredOnly?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(galleryImages);
  const conditions = [];
  if (opts?.category && opts.category !== "All") conditions.push(eq(galleryImages.category, opts.category));
  if (opts?.featuredOnly) conditions.push(eq(galleryImages.isFeatured, true));
  if (conditions.length > 0) query = query.where(and(...conditions)) as typeof query;
  return query.orderBy(galleryImages.sortOrder, desc(galleryImages.createdAt));
}

export async function createGalleryImage(data: InsertGalleryImage) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(galleryImages).values(data);
}

export async function updateGalleryImage(id: number, data: Partial<InsertGalleryImage>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(galleryImages).set({ ...data, updatedAt: new Date() }).where(eq(galleryImages.id, id));
}

export async function deleteGalleryImage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(galleryImages).where(eq(galleryImages.id, id));
}

export async function getGalleryCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(galleryImages);
  return Number(result[0]?.count ?? 0);
}

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────
export async function getTestimonials(featuredOnly = false) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(testimonials);
  if (featuredOnly) query = query.where(eq(testimonials.isFeatured, true)) as typeof query;
  return query.orderBy(testimonials.sortOrder);
}

export async function createTestimonial(data: InsertTestimonial) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(testimonials).values(data);
}

export async function updateTestimonial(id: number, data: Partial<InsertTestimonial>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(testimonials).set({ ...data, updatedAt: new Date() }).where(eq(testimonials.id, id));
}

export async function deleteTestimonial(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(testimonials).where(eq(testimonials.id, id));
}

// ─── CONTACT MESSAGES ─────────────────────────────────────────────────────────
export async function createContactMessage(data: InsertContactMessage) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(contactMessages).values(data);
  const id = (result as any)[0]?.insertId ?? null;
  if (id) {
    const rows = await db.select().from(contactMessages).where(eq(contactMessages.id, id)).limit(1);
    return rows[0];
  }
  return null;
}

export async function getContactMessages(opts?: { isRead?: boolean; inquiryType?: string }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(contactMessages);
  const conditions = [];
  if (opts?.isRead !== undefined) conditions.push(eq(contactMessages.isRead, opts.isRead));
  if (opts?.inquiryType && opts.inquiryType !== "all") conditions.push(eq(contactMessages.inquiryType, opts.inquiryType));
  if (conditions.length > 0) query = query.where(and(...conditions)) as typeof query;
  return query.orderBy(desc(contactMessages.createdAt));
}

export async function updateContactMessage(id: number, data: Partial<InsertContactMessage>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(contactMessages).set({ ...data, updatedAt: new Date() }).where(eq(contactMessages.id, id));
}

export async function deleteContactMessage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(contactMessages).where(eq(contactMessages.id, id));
}

export async function getUnreadMessageCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(contactMessages).where(eq(contactMessages.isRead, false));
  return Number(result[0]?.count ?? 0);
}

// ─── ACTIVITY LOGS ────────────────────────────────────────────────────────────
export async function logActivity(userId: number | null, action: string, entity?: string, entityId?: number, details?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values({ userId, action, entity, entityId, details });
}

export async function getActivityLogs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit);
}

// ─── ORDERS ───────────────────────────────────────────────────────────────────
export async function createOrder(data: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(orders).values(data);
}

export async function getOrdersByPhone(phone: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.customerPhone, phone)).orderBy(desc(orders.createdAt));
}

export async function getOrderByNumber(orderNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllOrders(opts?: { status?: string; orderType?: string; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (opts?.status) conditions.push(eq(orders.status, opts.status as any));
  if (opts?.orderType) conditions.push(eq(orders.orderType, opts.orderType as any));
  if (opts?.search) {
    conditions.push(
      or(
        like(orders.orderNumber, `%${opts.search}%`),
        like(orders.customerName, `%${opts.search}%`),
        like(orders.customerPhone, `%${opts.search}%`)
      )
    );
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(orders).where(whereClause).orderBy(desc(orders.createdAt));
}

export async function updateOrder(id: number, data: Partial<InsertOrder>) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set(data).where(eq(orders.id, id));
}

export async function deleteOrder(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(orders).where(eq(orders.id, id));
}

export async function getOrderStats() {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, preparing: 0, ready: 0, outForDelivery: 0, completed: 0, cancelled: 0 };
  const [total, pending, preparing, ready, outForDelivery, completed, cancelled] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(orders),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "pending")),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "preparing")),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "ready")),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "out-for-delivery")),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "completed")),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "cancelled")),
  ]);
  return {
    total: Number(total[0]?.count ?? 0),
    pending: Number(pending[0]?.count ?? 0),
    preparing: Number(preparing[0]?.count ?? 0),
    ready: Number(ready[0]?.count ?? 0),
    outForDelivery: Number(outForDelivery[0]?.count ?? 0),
    completed: Number(completed[0]?.count ?? 0),
    cancelled: Number(cancelled[0]?.count ?? 0),
  };
}

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { reservationsToday: 0, pendingReservations: 0, newMessages: 0, activeEvents: 0, featuredMenuItems: 0, galleryCount: 0 };
  const today = new Date().toISOString().split("T")[0];
  const [resToday, resPending, msgs, evts, featured, gallery] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(reservations).where(eq(reservations.date, today)),
    db.select({ count: sql<number>`count(*)` }).from(reservations).where(eq(reservations.status, "pending")),
    db.select({ count: sql<number>`count(*)` }).from(contactMessages).where(eq(contactMessages.isRead, false)),
    db.select({ count: sql<number>`count(*)` }).from(events).where(eq(events.isActive, true)),
    db.select({ count: sql<number>`count(*)` }).from(menuItems).where(eq(menuItems.isFeatured, true)),
    db.select({ count: sql<number>`count(*)` }).from(galleryImages),
  ]);
  return {
    reservationsToday: Number(resToday[0]?.count ?? 0),
    pendingReservations: Number(resPending[0]?.count ?? 0),
    newMessages: Number(msgs[0]?.count ?? 0),
    activeEvents: Number(evts[0]?.count ?? 0),
    featuredMenuItems: Number(featured[0]?.count ?? 0),
    galleryCount: Number(gallery[0]?.count ?? 0),
  };
}


// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────
export async function getFeaturedTestimonials() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(testimonials).where(eq(testimonials.isFeatured, true)).orderBy(testimonials.sortOrder);
}

export async function toggleTestimonialFeatured(id: number, featured: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(testimonials).set({ isFeatured: featured }).where(eq(testimonials.id, id));
}



export async function createPayment(data: InsertPayment): Promise<Payment | null> {
  const db = await getDb();
  if (!db) return null;
  await db.insert(payments).values(data);
  const result = await db.select().from(payments).where(eq(payments.customerEmail, data.customerEmail)).orderBy(desc(payments.createdAt)).limit(1);
  return result[0] || null;
}

export async function getPaymentById(id: number): Promise<Payment | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(payments).where(eq(payments.id, id));
  return result[0] || null;
}

export async function getPaymentByFlutterwaveRef(ref: string): Promise<Payment | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(payments).where(eq(payments.flutterwaveRef, ref));
  return result[0] || null;
}

export async function getPaymentsByOrderId(orderId: number): Promise<Payment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(eq(payments.orderId, orderId));
}

export async function getPaymentsByReservationId(reservationId: number): Promise<Payment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(eq(payments.reservationId, reservationId));
}

export async function updatePaymentStatus(id: number, status: string, completedAt?: Date): Promise<Payment | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(payments).set({ status: status as any, completedAt, updatedAt: new Date() }).where(eq(payments.id, id));
  return getPaymentById(id);
}

export async function getAllPayments(limit = 50, offset = 0): Promise<Payment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).limit(limit).offset(offset);
}
