REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_invoice_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_invoice() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_invoice_item() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_invoice() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_payment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_organization(text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_demo_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_demo_data() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO authenticated;
