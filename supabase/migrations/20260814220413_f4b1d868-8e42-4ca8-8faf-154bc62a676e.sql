DO $$
DECLARE _f record;
BEGIN
  FOR _f IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prorettype = 'pg_catalog.trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', _f.sig);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.enforce_org_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_financial_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_org_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_service(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_organization(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_service_records(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_route_order(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seed_demo_data() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reset_demo_data() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_service(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_service_records(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_route_order(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO authenticated;