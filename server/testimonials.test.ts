import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("testimonials", () => {
  it("retrieves featured testimonials", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    const result = await caller.testimonials.list({ featuredOnly: true });

    expect(Array.isArray(result)).toBe(true);
  });

  it("creates a new testimonial", async () => {
    const caller = appRouter.createCaller({
      user: {
        id: 1,
        openId: "test-editor",
        email: "editor@example.com",
        name: "Test Editor",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    const result = await caller.testimonials.create({
      reviewerName: "John Doe",
      rating: 5,
      reviewText: "Amazing food and service! Highly recommend.",
      sourceLabel: "Google",
      isFeatured: true,
      sortOrder: 1,
    });

    expect(result.success).toBe(true);
  });

  it("updates a testimonial", async () => {
    const caller = appRouter.createCaller({
      user: {
        id: 1,
        openId: "test-editor",
        email: "editor@example.com",
        name: "Test Editor",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    // Create first
    await caller.testimonials.create({
      reviewerName: "Jane Smith",
      rating: 4,
      reviewText: "Great place to hang out.",
      sourceLabel: "Facebook",
      isFeatured: true,
    });

    // Update (assuming id 1 exists)
    const result = await caller.testimonials.update({
      id: 1,
      rating: 5,
      reviewText: "Updated: Amazing experience!",
    });

    expect(result.success).toBe(true);
  });

  it("deletes a testimonial", async () => {
    const caller = appRouter.createCaller({
      user: {
        id: 1,
        openId: "test-admin",
        email: "admin@example.com",
        name: "Test Admin",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    const result = await caller.testimonials.delete({ id: 999 });

    expect(result.success).toBe(true);
  });

  it("lists all testimonials", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    const result = await caller.testimonials.list({ featuredOnly: false });

    expect(Array.isArray(result)).toBe(true);
  });
});
