-- 0010_sms_send_log.sql
-- Phase 6.2 — append-only audit table for transactional SMS sends.
-- Mirrors email_send_log. Used by the `send-sms` Edge Function for
-- short-window idempotency (no duplicate SMS within 5 minutes for the
-- same template+record+status).

create table if not exists public.sms_send_log (
    id                uuid primary key default gen_random_uuid(),
    idempotency_key   text not null,
    template          text not null,
    record_id         uuid not null,
    phone             text not null,
    status            text not null check (status in ('sent', 'failed')),
    provider_response jsonb,
    error             text,
    created_at        timestamptz not null default now()
);

create index if not exists sms_send_log_idem_recent_idx
    on public.sms_send_log (idempotency_key, created_at desc);

create index if not exists sms_send_log_record_idx
    on public.sms_send_log (record_id, created_at desc);

alter table public.sms_send_log enable row level security;

-- Edge function uses the service role and bypasses RLS; admins can read.
drop policy if exists sms_send_log_admin_read on public.sms_send_log;
create policy sms_send_log_admin_read
    on public.sms_send_log for select
    to authenticated
    using (public.is_admin(auth.uid()));
