# SQL Migrations

External Supabase is the production database. This folder holds every schema change as a numbered, append-only migration file.

## Rules

1. **Naming:** `NNNN_short_description.sql` — 4-digit zero-padded, monotonic. Example: `0007_add_loyalty_points.sql`.
2. **Append-only.** Never edit a shipped file. To fix a mistake, write a new migration that corrects it.
3. **Idempotent + transactional.** Every file is wrapped in `BEGIN; ... COMMIT;` and uses `IF NOT EXISTS` / `OR REPLACE` / `DROP ... IF EXISTS` so re-runs are safe.
4. **Run order = filename order.** Always run the full set top-to-bottom on a fresh database when verifying.
5. **RLS on every new table.** Plus at least one explicit policy.
6. **Roles never live on `profiles` / `users`.** Use the `user_roles` table + `has_role()` security-definer function.

See [`../docs/DEVELOPER_RULES.md`](../docs/DEVELOPER_RULES.md) §2 for the full spec, template, and verification command.

## How to apply on Supabase

**Option A — Supabase SQL Editor (manual):**
1. Open the project → SQL Editor → New query.
2. Paste the contents of the new migration file.
3. Run. Confirm success.
4. Mark the corresponding task `[x]` in `docs/PROJECT_PLAN.md`.

**Option B — psql (scripted):**
```bash
PGURL="postgresql://postgres:<password>@<host>:5432/postgres"
psql "$PGURL" -v ON_ERROR_STOP=1 -f sql/0007_add_loyalty_points.sql
```

## How to verify a migration before committing

```bash
docker run --rm -d --name pgtest -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:15
until PGPASSWORD=test psql -h localhost -p 55432 -U postgres -c 'select 1' >/dev/null 2>&1; do sleep 1; done
for f in sql/*.sql; do
  echo "▶ $f"
  PGPASSWORD=test psql -h localhost -p 55432 -U postgres -v ON_ERROR_STOP=1 -f "$f" || { docker rm -f pgtest; exit 1; }
done
docker rm -f pgtest
echo "✅ all migrations applied cleanly"
```

If it fails locally, it will fail on Supabase. Fix before opening a PR.
