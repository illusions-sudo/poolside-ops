CREATE OR REPLACE FUNCTION public.delete_service_record(p_service_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _status text;
BEGIN
  SELECT organization_id, status INTO _org, _status FROM service_records WHERE id = p_service_id;
  IF _org IS NULL OR _org <> current_org_id() OR NOT is_org_admin() THEN
    RAISE EXCEPTION 'You do not have permission to delete this visit.';
  END IF;
  IF _status = 'completed' OR EXISTS (SELECT 1 FROM invoice_items WHERE service_record_id = p_service_id) THEN
    RAISE EXCEPTION 'Finished or invoiced visits cannot be deleted.';
  END IF;
  DELETE FROM route_stops WHERE service_record_id = p_service_id;
  DELETE FROM service_checklist_items WHERE service_record_id = p_service_id;
  DELETE FROM service_chemistry_readings WHERE service_record_id = p_service_id;
  DELETE FROM service_chemical_usage WHERE service_record_id = p_service_id;
  DELETE FROM service_equipment_observations WHERE service_record_id = p_service_id;
  DELETE FROM service_photos WHERE service_record_id = p_service_id;
  DELETE FROM service_audit_log WHERE service_record_id = p_service_id;
  DELETE FROM service_records WHERE id = p_service_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_service_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_service_record(uuid) TO authenticated;