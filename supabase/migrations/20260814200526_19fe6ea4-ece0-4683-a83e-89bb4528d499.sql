REVOKE ALL ON FUNCTION public.log_service_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_service_checklist() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_access_service(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_service_records(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_route_order(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_service(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_service_records(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_route_order(uuid, uuid[]) TO authenticated;