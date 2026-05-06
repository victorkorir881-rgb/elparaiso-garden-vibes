
REVOKE EXECUTE ON FUNCTION public.fn_track_inventory_on_order()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_validate_coupon_usage()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_increment_coupon_usage()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_menu_item_stock_signals()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_award_loyalty_points()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_audit_site_settings()         FROM PUBLIC, anon, authenticated;
