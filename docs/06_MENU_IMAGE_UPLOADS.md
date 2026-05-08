# Menu Item Image Uploads

The admin UI (Admin → Menu → Add/Edit item) already supports image uploads:

- Component: `src/components/admin/ImageUploadField.tsx`
- Upload helper: `src/lib/storage-upload.ts` (browser-side resize + WebP encode via `src/lib/image-optimize.ts`)
- Wired in: `src/pages/admin/AdminMenu.tsx` (folder = `menu`)
- Stored on: Supabase Storage, bucket **`media`**, path `menu/<file>.webp` (+ thumbnail)
- Persisted to: `menu_items.image_url` (public URL)

The browser client used for the upload is `src/integrations/supabase/client.ts`, which reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from your `.env`. So uploads automatically go to whichever Supabase project those env vars point to — i.e. your own external project.

You only need to do **one-time setup** in your Supabase project: create the `media` bucket and add RLS policies so admins can write and the public can read.

---

## Option A — Run the SQL migration (recommended)

The repo already ships the migration: `sql/0011_media_storage.sql`.

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the entire contents of `sql/0011_media_storage.sql`.
3. Click **Run**.

That migration:

- Creates the `media` bucket (public read).
- Adds 4 policies on `storage.objects` scoped to `bucket_id = 'media'`:
  - `media_public_read` — anyone can `SELECT` (so `<img src=...>` works).
  - `media_admin_insert` / `_update` / `_delete` — gated on `public.is_admin_user()`.

> `is_admin_user()` is created by earlier migrations (`sql/0004_admin_auth_triggers.sql` / `0005_*`). Make sure those have been run first, otherwise the policies will fail to create. Run all `sql/*.sql` files in numeric order if this is a fresh project.

---

## Option B — Set it up manually in the dashboard

If you'd rather click through the UI:

### 1. Create the bucket

Supabase Dashboard → **Storage** → **New bucket**

- **Name:** `media`
- **Public bucket:** **ON** (so menu images load without signed URLs)
- File size limit: e.g. `5 MB` (optional, the client already optimises to <500 KB)
- Allowed MIME types: `image/webp, image/jpeg, image/png` (optional)

Click **Create bucket**.

### 2. Add RLS policies

Supabase Dashboard → **Storage** → **Policies** → on the `objects` table, click **New policy** four times:

**Policy 1 — Public read**
- Allowed operation: `SELECT`
- Target roles: `anon, authenticated`
- USING expression:
  ```sql
  bucket_id = 'media'
  ```

**Policy 2 — Admin insert**
- Allowed operation: `INSERT`
- Target roles: `authenticated`
- WITH CHECK expression:
  ```sql
  bucket_id = 'media' AND public.is_admin_user()
  ```

**Policy 3 — Admin update**
- Allowed operation: `UPDATE`
- Target roles: `authenticated`
- USING and WITH CHECK:
  ```sql
  bucket_id = 'media' AND public.is_admin_user()
  ```

**Policy 4 — Admin delete**
- Allowed operation: `DELETE`
- Target roles: `authenticated`
- USING expression:
  ```sql
  bucket_id = 'media' AND public.is_admin_user()
  ```

> If `public.is_admin_user()` does not yet exist in your project, create it from `sql/0004_admin_auth_triggers.sql` and `sql/0005_security_definer_triggers.sql` first.

---

## 3. Verify

1. Confirm `.env` has the right values:
   ```
   VITE_SUPABASE_URL="https://<your-project-ref>.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="<your anon/publishable key>"
   ```
2. Restart the dev server so Vite picks up the env.
3. Sign in to `/admin/login` with an admin account.
4. Go to **Admin → Menu → Add Item** (or edit an existing one).
5. Click **Upload file**, pick a JPG/PNG/HEIC. You should see:
   - “Optimizing…” → “Uploaded WxH · NN KB (X% smaller)”
   - A preview thumbnail
   - The public URL filled into the form
6. Save. The image should appear on the public `/menu` page.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `new row violates row-level security policy` on upload | Policies missing or `is_admin_user()` returns false for your account | Re-run the migration; ensure your user has an `admin` role in `user_roles` |
| `Bucket not found` | Bucket wasn't created or wrong name | Create bucket named exactly `media` |
| Image uploads OK but doesn't display on public site | Bucket isn't public | Toggle the `media` bucket to **Public** in the dashboard |
| `Upload failed: ... 401` | Not signed in as admin | Re-login at `/admin/login` |
