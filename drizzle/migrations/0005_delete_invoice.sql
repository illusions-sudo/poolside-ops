CREATE OR REPLACE FUNCTION public.guard_invoice_item_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _status text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN OLD; END IF;
  IF current_setting('app.deleting_invoice', true) = OLD.invoice_id::text THEN RETURN OLD; END IF;
  SELECT status INTO _status FROM public.invoices WHERE id = OLD.invoice_id;
  IF _status = 'void' THEN
    RAISE EXCEPTION 'Cannot modify items on a voided invoice' USING ERRCODE='check_violation';
  END IF;
  IF _status = 'paid' THEN
    RAISE EXCEPTION 'Cannot modify items on a fully paid invoice' USING ERRCODE='check_violation';
  END IF;
  RETURN OLD;
END; $function$;

CREATE OR REPLACE FUNCTION public.delete_invoice(p_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv record;
BEGIN
  SELECT id, organization_id, status, invoice_number INTO _inv FROM invoices WHERE id = p_invoice_id;
  IF _inv.id IS NULL OR _inv.organization_id <> current_org_id() OR NOT is_org_admin() THEN
    RAISE EXCEPTION 'You do not have permission to delete this invoice.';
  END IF;
  IF _inv.status NOT IN ('draft','void') THEN
    RAISE EXCEPTION 'Only draft or voided invoices can be deleted. Void this invoice first.';
  END IF;
  IF EXISTS (SELECT 1 FROM payments WHERE invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'This invoice has payments recorded, so it must be kept for your records.';
  END IF;
  PERFORM set_config('app.deleting_invoice', p_invoice_id::text, true);
  DELETE FROM invoice_items WHERE invoice_id = p_invoice_id;
  INSERT INTO financial_audit_log (organization_id, entity_type, entity_id, action, changes, changed_by)
  VALUES (_inv.organization_id, 'invoices', _inv.id, 'deleted',
          jsonb_build_object('invoice_number', _inv.invoice_number, 'status', _inv.status), auth.uid());
  DELETE FROM invoices WHERE id = p_invoice_id;
  PERFORM set_config('app.deleting_invoice', '', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_invoice(uuid) TO authenticated;