CREATE OR REPLACE FUNCTION public.guard_customer_property_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_org_admin() OR OLD.organization_id IS DISTINCT FROM public.current_org_id() THEN
    RAISE EXCEPTION 'Only an administrator in this company can delete customers or properties.' USING ERRCODE = '42501';
  END IF;
  IF TG_TABLE_NAME = 'customers' THEN
    IF OLD.active THEN RAISE EXCEPTION 'Deactivate this customer before permanently deleting it.' USING ERRCODE = '23514'; END IF;
    IF EXISTS (SELECT 1 FROM public.invoices WHERE customer_id = OLD.id) OR EXISTS (SELECT 1 FROM public.payments WHERE customer_id = OLD.id) THEN
      RAISE EXCEPTION 'This customer has invoices or payments. Keep it inactive to preserve your financial records.' USING ERRCODE = '23514';
    END IF;
  ELSE
    -- A customer cascade may remove its properties, including active ones, only after the inactive customer passed the guard above.
    IF OLD.active AND EXISTS (SELECT 1 FROM public.customers WHERE id = OLD.customer_id) THEN
      RAISE EXCEPTION 'Deactivate this property before permanently deleting it.' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM public.invoices WHERE property_id = OLD.id)
      OR EXISTS (SELECT 1 FROM public.invoice_items i JOIN public.service_records s ON s.id = i.service_record_id WHERE s.property_id = OLD.id)
      OR EXISTS (SELECT 1 FROM public.invoice_items i JOIN public.service_plans p ON p.id = i.service_plan_id WHERE p.property_id = OLD.id) THEN
      RAISE EXCEPTION 'This property is linked to an invoice. Keep it inactive to preserve your financial records.' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_customer_property_delete() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_customer_delete BEFORE DELETE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.guard_customer_property_delete();
CREATE TRIGGER guard_property_delete BEFORE DELETE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.guard_customer_property_delete();
CREATE OR REPLACE FUNCTION public.delete_customer(p_customer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _customer public.customers%ROWTYPE;
BEGIN
  SELECT * INTO _customer FROM public.customers WHERE id = p_customer_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_org_admin() OR _customer.organization_id IS DISTINCT FROM public.current_org_id() THEN
    RAISE EXCEPTION 'You do not have permission to delete this customer.' USING ERRCODE = '42501';
  END IF;
  IF _customer.active THEN RAISE EXCEPTION 'Deactivate this customer before permanently deleting it.' USING ERRCODE = '23514'; END IF;
  DELETE FROM public.customers WHERE id = p_customer_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.delete_property(p_property_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _property public.properties%ROWTYPE;
BEGIN
  SELECT * INTO _property FROM public.properties WHERE id = p_property_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_org_admin() OR _property.organization_id IS DISTINCT FROM public.current_org_id() THEN
    RAISE EXCEPTION 'You do not have permission to delete this property.' USING ERRCODE = '42501';
  END IF;
  IF _property.active THEN RAISE EXCEPTION 'Deactivate this property before permanently deleting it.' USING ERRCODE = '23514'; END IF;
  DELETE FROM public.properties WHERE id = p_property_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_customer(uuid), public.delete_property(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_customer(uuid), public.delete_property(uuid) TO authenticated;