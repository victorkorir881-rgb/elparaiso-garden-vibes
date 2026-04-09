import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("order placement flow", () => {
  it("creates a complete order with all details", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    const result = await caller.orders.create({
      customerName: "Alice Johnson",
      customerPhone: "+254712999888",
      customerEmail: "alice@example.com",
      items: [
        { id: 1, name: "Grilled Chicken Platter", price: "950", quantity: 2 },
        { id: 2, name: "Fresh Juice", price: "150", quantity: 2 },
      ],
      totalAmount: "2200",
      orderType: "delivery",
      deliveryAddress: "42 Kenyatta Avenue, Kisii CBD",
      specialInstructions: "Extra spicy, no mayo",
      estimatedTime: 35,
    });

    expect(result.success).toBe(true);
    expect(result.orderNumber).toMatch(/^ORD-\d{8}-[A-Z0-9]{5}$/);
  });

  it("creates a takeaway order without delivery address", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    const result = await caller.orders.create({
      customerName: "Bob Smith",
      customerPhone: "+254798765432",
      items: [
        { id: 3, name: "Nyama Choma", price: "800", quantity: 1 },
      ],
      totalAmount: "800",
      orderType: "takeaway",
    });

    expect(result.success).toBe(true);
    expect(result.orderNumber).toMatch(/^ORD-/);
  });

  it("creates a dine-in order", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    const result = await caller.orders.create({
      customerName: "Charlie Brown",
      customerPhone: "+254723456789",
      items: [
        { id: 4, name: "Ugali & Sukuma Wiki", price: "350", quantity: 1 },
        { id: 5, name: "Soda", price: "100", quantity: 1 },
      ],
      totalAmount: "450",
      orderType: "dine-in",
    });

    expect(result.success).toBe(true);
    expect(result.orderNumber).toMatch(/^ORD-/);
  });

  it("tracks orders by customer phone number", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    // Create an order
    await caller.orders.create({
      customerName: "Diana Prince",
      customerPhone: "+254791111111",
      items: [{ id: 6, name: "Samosas", price: "200", quantity: 3 }],
      totalAmount: "600",
      orderType: "delivery",
      deliveryAddress: "Wonder Woman Tower",
    });

    // Track by phone
    const orders = await caller.orders.trackByPhone({
      phone: "+254791111111",
    });

    expect(Array.isArray(orders)).toBe(true);
    expect(orders.length).toBeGreaterThan(0);
    expect(orders[0].customerPhone).toBe("+254791111111");
  });

  it("tracks a specific order by order number", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    // Create an order
    const createResult = await caller.orders.create({
      customerName: "Eve Wilson",
      customerPhone: "+254792222222",
      items: [{ id: 7, name: "Chapati", price: "100", quantity: 5 }],
      totalAmount: "500",
      orderType: "takeaway",
    });

    // Track by order number
    const order = await caller.orders.trackByNumber({
      orderNumber: createResult.orderNumber,
    });

    expect(order).toBeDefined();
    if (order && "customerName" in order) {
      expect(order.customerName).toBe("Eve Wilson");
      expect(order.orderNumber).toBe(createResult.orderNumber);
    }
  });

  it("retrieves multiple orders for a customer", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    const phone = "+254793333333";

    // Create multiple orders
    await caller.orders.create({
      customerName: "Frank Castle",
      customerPhone: phone,
      items: [{ id: 8, name: "Mandazi", price: "80", quantity: 4 }],
      totalAmount: "320",
      orderType: "delivery",
      deliveryAddress: "Punisher Street",
    });

    await caller.orders.create({
      customerName: "Frank Castle",
      customerPhone: phone,
      items: [{ id: 9, name: "Tea", price: "50", quantity: 2 }],
      totalAmount: "100",
      orderType: "takeaway",
    });

    // Track all orders for this phone
    const orders = await caller.orders.trackByPhone({ phone });

    expect(orders.length).toBeGreaterThanOrEqual(2);
    expect(orders.every((o: any) => o.customerPhone === phone)).toBe(true);
  });
});
