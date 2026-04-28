# Developer Rules — Elparaiso Garden Kisii

**Read this before writing a single line of code.** These rules exist so the project doesn't break in production. Violating them is grounds for PR rejection.

---

## 1. Project Structure (Lovable Convention)

After Phase 0 migration the layout is:

```
/
├── index.html                  # Vite entry (root)
├── src/
│   ├── main.tsx                # client bootstrap
│   ├── styles.css              # Tailwind v4 + design tokens (oklch)
│   ├── routes/                 # TanStack Router file-based routes
│   │   ├── __root.tsx          # root layout
│   │   ├── index.tsx           # /
│   │   ├── menu.tsx, order.tsx, ...
│   │   ├── admin/              # admin routes (auth-guarded)
│   │   └── api/public/         # webhooks, public APIs
│   ├── components/             # reusable React components
│   │   ├── ui/                 # shadcn primitives — DO NOT EDIT
│   │   ├── public/             # public-site components
│   │   └── admin/              # admin-only components
│   ├── hooks/, contexts/, lib/, assets/
│   ├── integrations/supabase/
│   │   ├── client.ts           # browser (publishable key)
│   │   ├── client.server.ts    # admin (service role) — SERVER ONLY
│   │   └── types.ts            # generated DB types
│   ├── server/
│   │   ├── *.server.ts         # server-only helpers (DB, secrets)
│   │   └── *.functions.ts      # createServerFn wrappers (safe to import in components)
│   └── shared/                 # types/constants used by both sides
├── sql/                        # numbered, append-only SQL migrations
│   ├── 0001_init.sql
│   └── README.md
├── docs/                       # all docs in .md
│   ├── PROJECT_PLAN.md         # the plan — keep updated
│   ├── DEVELOPER_RULES.md      # this file
│   ├── BUSINESS_RULES.md
│   ├── INTEGRATION.md
│   └── RUNBOOK.md
└── ...
```

**Rules:**
- ❌ Do NOT create `client/`, `server/` (top-level), `pages/`, or `app/` folders.
- ❌ Do NOT add a route file without also adding its `head()` metadata.
- ❌ Do NOT edit `src/components/ui/*` — extend via wrapper components.
- ❌ Do NOT edit `src/routeTree.gen.ts` — it is auto-generated.

---

## 2. Database & SQL Migrations (CRITICAL)

We use an **external Supabase project**. The agent does not have direct migration access — every schema change ships as a SQL file the human runs against Supabase.

### Rules
1. **Every schema change is a new file** in `/sql/` named `NNNN_short_description.sql` (4-digit zero-padded, monotonic).
2. **Files are append-only.** Never edit a shipped migration. To fix a mistake, write a new migration that corrects it.
3. **Files must run cleanly top-to-bottom on a fresh database.** Test before committing.
4. **Use idempotent DDL** wherever possible:
   - `CREATE TABLE IF NOT EXISTS`
   - `CREATE INDEX IF NOT EXISTS`
   - `DROP POLICY IF EXISTS "name" ON table; CREATE POLICY ...`
   - `CREATE OR REPLACE FUNCTION`
5. **Wrap each migration in a transaction:**
   ```sql
   BEGIN;
   -- your statements
   COMMIT;
   ```
6. **Always include:**
   - A header comment: `-- Migration: NNNN_name | Author | Date | Purpose`
   - `ALTER TABLE x ENABLE ROW LEVEL SECURITY;` for every new table
   - At least one RLS policy per table (default deny is wrong UX)
7. **Type and column conventions:**
   - Primary keys: `id uuid primary key default gen_random_uuid()`
   - Timestamps: `created_at timestamptz not null default now()`, `updated_at timestamptz`
   - Foreign keys: `references public.x(id) on delete cascade` (or `set null` — be explicit)
   - Enums: define with `create type public.<name> as enum (...)` in their own migration
8. **Never store user roles on `profiles` or `users`.** Use a dedicated `user_roles` table + `has_role()` security-definer function (see Phase 5 in PROJECT_PLAN.md). Putting roles on the user record creates privilege-escalation vulnerabilities.
9. **After writing a migration:** update Drizzle schema in `src/server/db.ts` to match exactly — column names, types, nullability, defaults.

### Template

```sql
-- Migration: 0007_add_loyalty_points | Jane Doe | 2026-05-12
-- Adds loyalty_points table + RLS so users can read their own points.

BEGIN;

CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points      integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);

CREATE INDEX IF NOT EXISTS loyalty_points_user_id_idx
  ON public.loyalty_points(user_id);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own points" ON public.loyalty_points;
CREATE POLICY "Users read own points"
  ON public.loyalty_points FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage all points" ON public.loyalty_points;
CREATE POLICY "Admins manage all points"
  ON public.loyalty_points FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMIT;
```

### Verifying a migration runs

Before committing, run it locally against a throwaway Postgres:

```bash
docker run --rm -d --name pgtest -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:15
sleep 3
for f in sql/*.sql; do
  echo "▶ $f"
  PGPASSWORD=test psql -h localhost -p 55432 -U postgres -v ON_ERROR_STOP=1 -f "$f" || exit 1
done
docker rm -f pgtest
```

If it doesn't run cleanly there, it won't run on Supabase. Fix it before opening a PR.

---

## 3. Server-Side Code

- Server-only helpers (DB, secrets) live in `*.server.ts` files. The Vite import-protection plugin will fail the build if a component imports one.
- Components import `*.functions.ts` only — these wrap logic in `createServerFn` (or tRPC procedures during the transition).
- **Read `process.env` inside the handler body**, never at module scope:

  ```ts
  // ❌ wrong — undefined in browser bundle
  const KEY = process.env.MPESA_KEY;

  // ✅ right
  export const charge = createServerFn({ method: "POST" })
    .handler(async () => {
      const key = process.env.MPESA_KEY!;
      ...
    });
  ```
- **Never** import `client.server.ts` from anything under `src/components/`, `src/hooks/`, or `src/routes/*` (route loaders are isomorphic). Wrap admin queries in a server function and call that from the loader.
- Webhooks live under `src/routes/api/public/*` and **must** verify a signature before doing anything.

---

## 4. Supabase Clients

| Client | Import | Use in | Auth |
|---|---|---|---|
| Browser | `@/integrations/supabase/client` | components, hooks | publishable key, RLS as user |
| Auth middleware | `@/integrations/supabase/auth-middleware` | `createServerFn` needing user | bearer token, RLS as user |
| Admin | `@/integrations/supabase/client.server` | trusted server only | service role, **bypasses RLS** |

Never expose the service role key. Never check admin status from `localStorage`. Always validate on the server with `has_role()`.

---

## 5. Secrets & API Keys

- Publishable / anon keys → can live in code (`VITE_*` env vars).
- Anything else (service role key, payment secrets, webhook signing keys) → use the secrets tool, read via `process.env` in handlers only.
- **Never** commit a `.env` with real secrets. The existing `.env` in this repo is dev-only and ignored by deploys.

---

## 6. Frontend Rules

- All colors come from `src/styles.css` design tokens. **Never** hardcode `text-white`, `bg-black`, hex codes, etc. in components.
- All tokens use `oklch()`.
- Use shadcn primitives + variants (`cva`) for component styling.
- Every route's `head()` has a unique title (<60 chars), description (<160 chars), `og:title`, `og:description`. Add `og:image` only when a meaningful image exists for that route (do not add at root — it overrides leaf images).
- Single `<h1>` per page. Semantic HTML. Alt text on every `<img>`.
- Use `<Link to="...">` from `@tanstack/react-router`. **No** hash-anchor navigation between major content sections — each gets its own route.

---

## 7. Workflow

1. Pick one unchecked task from `docs/PROJECT_PLAN.md`. Mark it `[~]` with your name + date.
2. Branch: `feature/<phase>-<short-name>` (e.g. `feature/7.2-mpesa-stk-push`).
3. Implement. Keep diffs focused — one task per PR.
4. **Run before pushing:**
   - `bun run check` — 0 TS errors
   - `bunx vitest run` — all green
   - `bun run build` — succeeds
   - SQL migration tested per §2
5. Update docs in the same PR:
   - Mark the task `[x]` in `docs/00_PROJECT_PLAN.md`
   - Update `README.md` if user-visible behavior changed
   - Update `docs/02_BUSINESS_RULES.md` if a rule changed
   - Update `docs/03_INTEGRATION.md` if setup steps changed
6. PR description links to the task ID (e.g. "Closes plan task 7.2").

---

## 8. Documentation Format

- **All documentation is Markdown (`.md`).** No PDFs, Notion exports, Word docs.
- Lives under `/docs/`.
- **Every file in `/docs/` and `/sql/` MUST start with a number** so listings sort by intended reading / run order.
  - Top-level docs: 2-digit zero-padded prefix → `00_PROJECT_PLAN.md`, `01_DEVELOPER_RULES.md`, `02_BUSINESS_RULES.md`.
  - Feature docs under `/docs/features/`: 2-digit prefix per feature → `01_payments.md`, `02_loyalty.md`.
  - SQL migrations: 4-digit zero-padded prefix → `0001_init.sql`, `0007_add_loyalty_points.sql`.
  - Numbers are **monotonic and never reused**. Pick the next free number.
- New feature → new `.md` file under `/docs/features/NN_<feature>.md`.

---

## 9. Testing

- Every new tRPC procedure / server function gets at least one Vitest test.
- Every new RLS policy gets a test asserting both allow + deny paths.
- Run `bunx vitest run` before every push. Don't merge red.

---

## 10. Things That Will Break Production — DO NOT

- ❌ Edit a shipped SQL migration file.
- ❌ Store user roles on the `profiles` table.
- ❌ Read `process.env` at module top-level in shared/server files.
- ❌ Import `client.server.ts` from client code or route loaders.
- ❌ Use the service role key in a browser-bundled file.
- ❌ Skip RLS on a new table.
- ❌ Skip webhook signature verification on `/api/public/*`.
- ❌ Hardcode colors instead of using design tokens.
- ❌ Push without running `bun run check && bunx vitest run && bun run build`.
- ❌ Mark a plan task `[x]` without tests + docs updated.

When in doubt: re-read this file, then ask in PR comments.
