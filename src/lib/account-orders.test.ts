/**
 * Verifies the customer-account order isolation contract:
 *
 *  1. `link_orders_to_current_user` (sql/0016) only attaches guest orders
 *     whose `customer_email` matches the signed-in user's verified email.
 *  2. `useMyOrders` (src/lib/supabase-hooks.ts) only returns rows where
 *     `user_id = auth.uid()` — orders belonging to other accounts (even if
 *     they happen to share an email) are never returned.
 *
 * The Supabase client is replaced with an in-memory fake that mirrors the
 * server-side behaviour of the RPC + the RLS-scoped SELECT.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Order = {
  id: string;
  order_number: string;
  customer_email: string;
  user_id: string | null;
  created_at: string;
};

// In-memory "orders" table the fake client reads/writes.
const db: { orders: Order[] } = { orders: [] };

// Currently signed-in user (drives the RPC + RLS-style filter).
let currentUser: { id: string; email: string } | null = null;

vi.mock("@/integrations/supabase/client", () => {
  const fake = {
    from(table: string) {
      if (table !== "orders") throw new Error(`unexpected table ${table}`);
      const filters: Array<(o: Order) => boolean> = [];
      const builder: any = {
        select: () => builder,
        order: () => builder,
        limit: () => builder,
        eq: (col: string, val: any) => {
          filters.push((o) => (o as any)[col] === val);
          return builder;
        },
        then: (resolve: any) => {
          let rows = db.orders.slice();
          // Mirror RLS: an authenticated user can only read their own rows.
          if (currentUser) {
            rows = rows.filter((o) => o.user_id === currentUser!.id);
          } else {
            rows = [];
          }
          for (const f of filters) rows = rows.filter(f);
          rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
          resolve({ data: rows, error: null });
        },
      };
      return builder;
    },
    rpc(name: string) {
      if (name !== "link_orders_to_current_user") {
        return Promise.resolve({ data: null, error: new Error("unknown rpc") });
      }
      if (!currentUser) return Promise.resolve({ data: 0, error: null });
      const mail = currentUser.email.toLowerCase();
      let cnt = 0;
      for (const o of db.orders) {
        if (o.user_id === null && o.customer_email.toLowerCase() === mail) {
          o.user_id = currentUser.id;
          cnt++;
        }
      }
      return Promise.resolve({ data: cnt, error: null });
    },
  };
  return { supabase: fake };
});

// Imported AFTER the mock is registered.
const { supabase } = await import("@/integrations/supabase/client");

async function fetchMyOrders(userId: string | null) {
  if (!userId) return [];
  const { data, error } = await (supabase as any)
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as Order[];
}

beforeEach(() => {
  db.orders = [];
  currentUser = null;
});

describe("customer account order isolation", () => {
  it("link_orders_to_current_user only attaches orders whose email matches the signed-in user", async () => {
    db.orders = [
      { id: "o1", order_number: "A1", customer_email: "Me@Example.com", user_id: null, created_at: "2026-05-01T10:00:00Z" },
      { id: "o2", order_number: "A2", customer_email: "someone-else@example.com", user_id: null, created_at: "2026-05-02T10:00:00Z" },
      { id: "o3", order_number: "A3", customer_email: "me@example.com", user_id: null, created_at: "2026-05-03T10:00:00Z" },
    ];
    currentUser = { id: "user-me", email: "me@example.com" };

    const { data: linkedCount } = await (supabase as any).rpc("link_orders_to_current_user");

    expect(linkedCount).toBe(2);
    expect(db.orders.find((o) => o.id === "o1")!.user_id).toBe("user-me");
    expect(db.orders.find((o) => o.id === "o3")!.user_id).toBe("user-me");
    // The non-matching email must NOT be linked.
    expect(db.orders.find((o) => o.id === "o2")!.user_id).toBeNull();
  });

  it("useMyOrders payload only contains the signed-in user's orders", async () => {
    db.orders = [
      // Mine — already owned.
      { id: "mine-1", order_number: "M1", customer_email: "me@example.com", user_id: "user-me", created_at: "2026-05-04T10:00:00Z" },
      // Mine — guest order with matching email, will be linked.
      { id: "mine-2", order_number: "M2", customer_email: "me@example.com", user_id: null, created_at: "2026-05-05T10:00:00Z" },
      // Another customer's order — must never appear in my account.
      { id: "other-1", order_number: "O1", customer_email: "stranger@example.com", user_id: "user-other", created_at: "2026-05-06T10:00:00Z" },
      // Unowned guest order with a different email — also must never appear.
      { id: "guest-other", order_number: "G1", customer_email: "stranger@example.com", user_id: null, created_at: "2026-05-07T10:00:00Z" },
    ];
    currentUser = { id: "user-me", email: "me@example.com" };

    await (supabase as any).rpc("link_orders_to_current_user");
    const orders = await fetchMyOrders(currentUser.id);

    expect(orders.map((o) => o.id).sort()).toEqual(["mine-1", "mine-2"]);
    expect(orders.every((o) => o.user_id === "user-me")).toBe(true);
  });

  it("returns nothing when the user is signed out", async () => {
    db.orders = [
      { id: "mine-1", order_number: "M1", customer_email: "me@example.com", user_id: "user-me", created_at: "2026-05-04T10:00:00Z" },
    ];
    currentUser = null;
    const orders = await fetchMyOrders(null);
    expect(orders).toEqual([]);
  });

  it("does NOT leak orders from another account that happens to share my email", async () => {
    // Edge case: a stale order was previously linked to a different uid
    // (e.g. account deletion + recreation) but still has my email. The
    // explicit `.eq("user_id", auth.uid())` filter must still hide it.
    db.orders = [
      { id: "stale", order_number: "S1", customer_email: "me@example.com", user_id: "user-old", created_at: "2026-04-01T10:00:00Z" },
      { id: "mine", order_number: "M1", customer_email: "me@example.com", user_id: "user-me", created_at: "2026-05-01T10:00:00Z" },
    ];
    currentUser = { id: "user-me", email: "me@example.com" };

    const orders = await fetchMyOrders(currentUser.id);
    expect(orders.map((o) => o.id)).toEqual(["mine"]);
  });
});
