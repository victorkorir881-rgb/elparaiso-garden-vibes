-- 0028: admin profile phone + on-duty toggle
-- Lets each admin store their personal phone and mark themselves as on-duty.
-- The send-sms edge function uses on-duty admins as new-order recipients.

ALTER TABLE public.admin_profiles
  ADD COLUMN IF NOT EXISTS phone   text,
  ADD COLUMN IF NOT EXISTS on_duty boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS admin_profiles_on_duty_idx
  ON public.admin_profiles (on_duty)
  WHERE on_duty = true;
