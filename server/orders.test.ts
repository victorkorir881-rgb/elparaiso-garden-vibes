import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createManagerContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "manager-user",
    email: "manager@example.com",
    name: "Manager User",
    loginMethod: "manus",
    role: "manager",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("orders", () => {
  it("creates a new order with public procedure", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    const result = await caller.orders.create({
      customerName: "John Doe",
      customerPhone: "+254791224513",
      customerEmail: "john@example.com",
      items: [
        { id: 1, name: "Grilled Chicken", price: "800", quantity: 2 },
      ],
      totalAmount: "1600",
      orderType: "delivery",
      deliveryAddress: "123 Main St, Kisii",
      specialInstructions: "No onions",
      estimatedTime: 30,
      paymentMethod: "mpesa",
    });

    expect(result.success).toBe(true);
    expect(result.orderNumber).toMatch(/^ORD-/);
  });

  it("tracks orders by phone number", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    // Create an order first
    const createResult = await caller.orders.create({
      customerName: "Jane Smith",
      customerPhone: "+254712345678",
      items: [{ id: 2, name: "Ugali", price: "300", quantity: 1 }],
      totalAmount: "300",
      orderType: "takeaway",
    });

    // Track by phone
    const trackResult = await caller.orders.trackByPhone({
      phone: "+254712345678",
    });

    expect(Array.isArray(trackResult)).toBe(true);
    expect(trackResult.length).toBeGreaterThan(0);
    expect(trackResult[0].customerPhone).toBe("+254712345678");
  });

  it("lists orders with manager access", async () => {
    const { ctx } = createManagerContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.orders.list({});

    expect(Array.isArray(result)).toBe(true);
  });

  it("updates order status with manager access", async () => {
    const { ctx } = createManagerContext();
    const caller = appRouter.createCaller(ctx);

    // Create an order first (as public)
    const publicCaller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    const createResult = await publicCaller.orders.create({
      customerName: "Test User",
      customerPhone: "+254798765432",
      items: [{ id: 3, name: "Nyama Choma", price: "500", quantity: 1 }],
      totalAmount: "500",
      orderType: "dine-in",
    });

    // Get the order number
    const orderNumber = createResult.orderNumber;

    // Track it to get the ID
    const trackResult = await publicCaller.orders.trackByNumber({
      orderNumber,
    });

    if (trackResult && "id" in trackResult) {
      // Update status
      const updateResult = await caller.orders.update({
        id: trackResult.id,
        status: "preparing",
        adminNotes: "Started preparing",
        estimatedTime: 15,
      });

      expect(updateResult.success).toBe(true);
    }
  });

  it("gets order statistics with manager access", async () => {
    const { ctx } = createManagerContext();
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.orders.stats();

    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("pending");
    expect(stats).toHaveProperty("preparing");
    expect(stats).toHaveProperty("ready");
    expect(stats).toHaveProperty("outForDelivery");
    expect(stats).toHaveProperty("completed");
    expect(stats).toHaveProperty("cancelled");
    expect(typeof stats.total).toBe("number");
  });
});
