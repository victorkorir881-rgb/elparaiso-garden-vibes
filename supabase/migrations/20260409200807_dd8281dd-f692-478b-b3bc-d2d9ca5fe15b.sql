
-- Trigger: auto-assign super_admin role to the first admin profile
DROP TRIGGER IF EXISTS on_first_admin_assignment ON public.admin_profiles;
CREATE TRIGGER on_first_admin_assignment
  AFTER INSERT ON public.admin_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_first_admin();

-- Trigger: auto-update updated_at timestamps
DROP TRIGGER IF EXISTS set_updated_at_admin_profiles ON public.admin_profiles;
CREATE TRIGGER set_updated_at_admin_profiles BEFORE UPDATE ON public.admin_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_admin_activity_log ON public.admin_activity_log;
CREATE TRIGGER set_updated_at_admin_activity_log BEFORE UPDATE ON public.admin_activity_log FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_chatbot_faqs ON public.chatbot_faqs;
CREATE TRIGGER set_updated_at_chatbot_faqs BEFORE UPDATE ON public.chatbot_faqs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_chatbot_conversations ON public.chatbot_conversations;
CREATE TRIGGER set_updated_at_chatbot_conversations BEFORE UPDATE ON public.chatbot_conversations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_events ON public.events;
CREATE TRIGGER set_updated_at_events BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_menu_categories ON public.menu_categories;
CREATE TRIGGER set_updated_at_menu_categories BEFORE UPDATE ON public.menu_categories FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_menu_items ON public.menu_items;
CREATE TRIGGER set_updated_at_menu_items BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_reservation_leads ON public.reservation_leads;
CREATE TRIGGER set_updated_at_reservation_leads BEFORE UPDATE ON public.reservation_leads FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_reviews ON public.reviews;
CREATE TRIGGER set_updated_at_reviews BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_site_settings ON public.site_settings;
CREATE TRIGGER set_updated_at_site_settings BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
