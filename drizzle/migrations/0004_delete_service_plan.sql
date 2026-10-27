CREATE OR REPLACE FUNCTION public.delete_service_plan(p_plan_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  SELECT organization_id INTO _org FROM service_plans WHERE id = p_plan_id;
  IF _org IS NULL OR _org <> current_org_id() OR NOT is_org_admin() THEN
    RAISE EXCEPTION 'You do not have permission to delete this service plan.';
  END IF;
  -- Remove upcoming visits that haven't happened yet.
  DELETE FROM route_stops WHERE service_record_id IN (
    SELECT id FROM service_records WHERE service_plan_id = p_plan_id AND status IN ('scheduled','en_route'));
  DELETE FROM service_records WHERE service_plan_id = p_plan_id AND status IN ('scheduled','en_route');
  -- Keep finished visit history and invoice lines, just detach them.
  UPDATE service_records SET service_plan_id = NULL WHERE service_plan_id = p_plan_id;
  UPDATE invoice_items SET service_plan_id = NULL WHERE service_plan_id = p_plan_id;
  DELETE FROM service_plans WHERE id = p_plan_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_service_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_service_plan(uuid) TO authenticated;