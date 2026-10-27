CREATE OR REPLACE FUNCTION public.enforce_org_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _org uuid; _other uuid;
BEGIN
  _org := NEW.organization_id;

  IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id is immutable' USING ERRCODE = 'check_violation';
  END IF;

  IF TG_TABLE_NAME = 'properties' THEN
    SELECT organization_id INTO _other FROM public.customers WHERE id = NEW.customer_id;
    IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Customer belongs to a different organization' USING ERRCODE='check_violation'; END IF;

  ELSIF TG_TABLE_NAME = 'pools' THEN
    SELECT organization_id INTO _other FROM public.properties WHERE id = NEW.property_id;
    IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Property belongs to a different organization' USING ERRCODE='check_violation'; END IF;

  ELSIF TG_TABLE_NAME IN ('service_plans','service_records') THEN
    SELECT organization_id INTO _other FROM public.customers WHERE id = NEW.customer_id;
    IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Customer belongs to a different organization' USING ERRCODE='check_violation'; END IF;
    SELECT organization_id INTO _other FROM public.properties WHERE id = NEW.property_id;
    IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Property belongs to a different organization' USING ERRCODE='check_violation'; END IF;
    IF NEW.pool_id IS NOT NULL THEN
      SELECT organization_id INTO _other FROM public.pools WHERE id = NEW.pool_id;
      IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Pool belongs to a different organization' USING ERRCODE='check_violation'; END IF;
    END IF;
    IF NEW.technician_id IS NOT NULL THEN
      SELECT organization_id INTO _other FROM public.profiles WHERE id = NEW.technician_id;
      IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Technician belongs to a different organization' USING ERRCODE='check_violation'; END IF;
    END IF;
    -- Nested IF: plpgsql does not short-circuit AND, and service_plans has no service_plan_id column.
    IF TG_TABLE_NAME = 'service_records' THEN
      IF NEW.service_plan_id IS NOT NULL THEN
        SELECT organization_id INTO _other FROM public.service_plans WHERE id = NEW.service_plan_id;
        IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Service plan belongs to a different organization' USING ERRCODE='check_violation'; END IF;
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'invoices' THEN
    SELECT organization_id INTO _other FROM public.customers WHERE id = NEW.customer_id;
    IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Customer belongs to a different organization' USING ERRCODE='check_violation'; END IF;
    IF NEW.property_id IS NOT NULL THEN
      SELECT organization_id INTO _other FROM public.properties WHERE id = NEW.property_id;
      IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Property belongs to a different organization' USING ERRCODE='check_violation'; END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'customer_notes' THEN
    SELECT organization_id INTO _other FROM public.customers WHERE id = NEW.customer_id;
    IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Customer belongs to a different organization' USING ERRCODE='check_violation'; END IF;
    IF NEW.property_id IS NOT NULL THEN
      SELECT organization_id INTO _other FROM public.properties WHERE id = NEW.property_id;
      IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Property belongs to a different organization' USING ERRCODE='check_violation'; END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'route_days' THEN
    IF NEW.technician_id IS NOT NULL THEN
      SELECT organization_id INTO _other FROM public.profiles WHERE id = NEW.technician_id;
      IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Technician belongs to a different organization' USING ERRCODE='check_violation'; END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'route_stops' THEN
    SELECT organization_id INTO _other FROM public.route_days WHERE id = NEW.route_day_id;
    IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Route belongs to a different organization' USING ERRCODE='check_violation'; END IF;
    SELECT organization_id INTO _other FROM public.service_records WHERE id = NEW.service_record_id;
    IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Service belongs to a different organization' USING ERRCODE='check_violation'; END IF;

  ELSIF TG_TABLE_NAME IN ('service_checklist_items','service_chemistry_readings','service_chemical_usage',
                          'service_equipment_observations','service_photos') THEN
    SELECT organization_id INTO _other FROM public.service_records WHERE id = NEW.service_record_id;
    IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Service belongs to a different organization' USING ERRCODE='check_violation'; END IF;
  END IF;

  RETURN NEW;
END; $function$;