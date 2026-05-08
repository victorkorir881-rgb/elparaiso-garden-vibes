-- 0011_media_storage.sql
-- Storage bucket for admin-uploaded media (gallery, menu items, events).
-- Public read; only admins can write. Idempotent.

-- 1. Create the bucket if not present (public read).
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = excluded.public;

-- 2. Policies on storage.objects scoped to bucket_id = 'media'.
do $$
begin
  -- Public read
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'media_public_read'
  ) then
    create policy media_public_read
      on storage.objects for select
      using (bucket_id = 'media');
  end if;

  -- Admin write (insert/update/delete) — relies on public.is_admin_user()
  -- created in earlier migrations. Falls back to denying if helper missing.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'media_admin_insert'
  ) then
    create policy media_admin_insert
      on storage.objects for insert
      with check (bucket_id = 'media' and public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'media_admin_update'
  ) then
    create policy media_admin_update
      on storage.objects for update
      using (bucket_id = 'media' and public.is_admin_user())
      with check (bucket_id = 'media' and public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'media_admin_delete'
  ) then
    create policy media_admin_delete
      on storage.objects for delete
      using (bucket_id = 'media' and public.is_admin_user());
  end if;
end $$;
