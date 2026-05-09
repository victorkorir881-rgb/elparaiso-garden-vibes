-- 0014_whatsapp_send_log.sql
-- Phase 6.3 — append-only audit table for WhatsApp Business Cloud API sends.
-- Mirrors sms_send_log. Used by the `send-whatsapp` Edge Function for
-- short-window idempotency (no duplicate WhatsApp message within 5 minutes
-- for the same template+record+status key).

create table if not exists public.whatsapp_send_log (
    id                uuid primary key default gen_random_uuid(),
    idempotency_key   text not null,
    template          text not null,
    record_id         uuid not null,
    phone             text not null,
    status            text not null check (status in ('sent', 'failed', 'skipped')),
    provider_message_id text,
    provider_response jsonb,
    error             text,
    created_at        timestamptz not null default now()
);

create index if not exists whatsapp_send_log_idem_recent_idx
    on public.whatsapp_send_log (idempotency_key, created_at desc);

create index if not exists whatsapp_send_log_record_idx
    on public.whatsapp_send_log (record_id, created_at desc);

alter table public.whatsapp_send_log enable row level security;

drop policy if exists whatsapp_send_log_admin_read on public.whatsapp_send_log;
create policy whatsapp_send_log_admin_read
    on public.whatsapp_send_log for select
    to authenticated
    using (public.is_admin(auth.uid()));
