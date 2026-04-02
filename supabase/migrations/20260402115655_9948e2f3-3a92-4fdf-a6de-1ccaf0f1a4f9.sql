
-- Fix security definer views by recreating with security_invoker
CREATE OR REPLACE VIEW public.v_daily_conversation_stats
WITH (security_invoker = true)
AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COUNT(*) AS total_conversations,
  COUNT(DISTINCT session_id) AS unique_sessions
FROM public.chatbot_conversations
GROUP BY 1 ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.v_popular_menu_items
WITH (security_invoker = true)
AS
SELECT
  mi.id, mi.name, mi.price, mc.name AS category,
  mi.is_available, mi.is_featured
FROM public.menu_items mi
JOIN public.menu_categories mc ON mc.id = mi.category_id
WHERE mi.is_available = true
ORDER BY mi.is_featured DESC, mi.sort_order ASC;

-- Fix function search path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
