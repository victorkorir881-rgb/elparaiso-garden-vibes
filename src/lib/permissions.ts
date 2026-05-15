// Role-based access control for the admin panel.
// RLS in Postgres is the source of truth for data access; this module
// controls UI surface area (nav visibility + route guards).

export type AdminRole = "super_admin" | "admin" | "manager" | "staff";

export const ALL_ADMIN_ROLES: readonly AdminRole[] = [
  "super_admin",
  "admin",
  "manager",
  "staff",
] as const;

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return !!role && (ALL_ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Per-route access matrix. Keys are admin route paths (no trailing slash).
 * The values list the roles allowed to *see* and *open* that route.
 *
 * - super_admin: everything (implicit, never listed individually).
 * - admin: full operational + content + system, except sensitive identity
 *   surfaces (Users management, Audit Log) which stay super_admin only.
 * - manager: operations, content, analytics, site settings.
 * - staff: front-of-house — orders, reservations, messages, dashboard.
 */
const ROUTE_ROLES: Record<string, readonly AdminRole[]> = {
  "/admin":                ["super_admin", "admin", "manager", "staff"],
  "/admin/analytics":      ["super_admin", "admin", "manager"],

  "/admin/orders":         ["super_admin", "admin", "manager", "staff"],
  "/admin/reservations":   ["super_admin", "admin", "manager", "staff"],
  "/admin/messages":       ["super_admin", "admin", "manager", "staff"],

  "/admin/menu":           ["super_admin", "admin", "manager"],
  "/admin/pricing":        ["super_admin", "admin", "manager"],
  "/admin/events":         ["super_admin", "admin", "manager"],
  "/admin/gallery":        ["super_admin", "admin", "manager"],
  "/admin/testimonials":   ["super_admin", "admin", "manager"],

  "/admin/settings":       ["super_admin", "admin", "manager"],
  "/admin/business-rules": ["super_admin", "admin"],
  "/admin/seo":            ["super_admin", "admin"],
  "/admin/users":          ["super_admin"],
  "/admin/audit-log":      ["super_admin"],
  "/admin/profile":        ["super_admin", "admin", "manager", "staff"],
};

/** Always-allowed admin paths (sign-in, accept invite, profile). */
const ALWAYS_ALLOWED = new Set<string>([
  "/admin/login",
  "/admin/accept-invite",
]);

export function canAccessAdminPath(
  role: string | null | undefined,
  path: string,
): boolean {
  if (ALWAYS_ALLOWED.has(path)) return true;
  if (!isAdminRole(role)) return false;
  if (role === "super_admin") return true;

  // Find the most specific matching key (handles nested admin pages).
  const keys = Object.keys(ROUTE_ROLES).sort((a, b) => b.length - a.length);
  const match = keys.find((k) => path === k || path.startsWith(k + "/"));
  if (!match) return false;
  return ROUTE_ROLES[match].includes(role);
}

/** Convenience used by the sidebar to hide nav links the user can't open. */
export function canSeeNavItem(role: string | null | undefined, to: string): boolean {
  return canAccessAdminPath(role, to);
}
