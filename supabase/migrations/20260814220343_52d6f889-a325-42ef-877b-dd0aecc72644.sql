-- =========================================================
-- 1. Role/admin check scoped to the user's current org
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('owner','admin')
      AND p.active
      AND (ur.organization_id IS NULL OR ur.organization_id = p.organization_id)
  )
$$;

-- Technicians may only touch services actually assigned to them
CREATE OR REPLACE FUNCTION public.can_access_service(_service_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_records r
    WHERE r.id = _service_id
      AND r.organization_id = public.current_org_id()
      AND (public.is_org_admin() OR r.technician_id = auth.uid())
  )
$$;

-- =========================================================
-- 2. Service record policies: admin-only create/assign/schedule
-- =========================================================
DROP POLICY IF EXISTS records_select ON public.service_records;
CREATE POLICY records_select ON public.service_records FOR SELECT TO authenticated
USING (organization_id = public.current_org_id()
       AND (public.is_org_admin() OR technician_id = auth.uid()));

DROP POLICY IF EXISTS records_insert ON public.service_records;
CREATE POLICY records_insert ON public.service_records FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

DROP POLICY IF EXISTS records_update ON public.service_records;
CREATE POLICY records_update ON public.service_records FOR UPDATE TO authenticated
USING (organization_id = public.current_org_id()
       AND (public.is_org_admin() OR technician_id = auth.uid()))
WITH CHECK (organization_id = public.current_org_id()
            AND (public.is_org_admin() OR technician_id = auth.uid()));

-- Column-level guard: technicians cannot reassign, rescope or reschedule work
CREATE OR REPLACE FUNCTION public.guard_service_record_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id cannot be changed' USING ERRCODE = 'check_violation';
  END IF;

  -- service_role / migrations / SECURITY DEFINER maintenance jobs
  IF auth.uid() IS NULL OR public.is_org_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.technician_id IS DISTINCT FROM OLD.technician_id
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.property_id IS DISTINCT FROM OLD.property_id
     OR NEW.pool_id IS DISTINCT FROM OLD.pool_id
     OR NEW.service_plan_id IS DISTINCT FROM OLD.service_plan_id
     OR NEW.service_date IS DISTINCT FROM OLD.service_date
     OR NEW.scheduled_time IS DISTINCT FROM OLD.scheduled_time THEN
    RAISE EXCEPTION 'Only an administrator can reassign or reschedule a service'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS t_guard_service_record ON public.service_records;
CREATE TRIGGER t_guard_service_record BEFORE UPDATE ON public.service_records
FOR EACH ROW EXECUTE FUNCTION public.guard_service_record_update();

-- =========================================================
-- 3. Cross-organization referential integrity
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_org_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    IF TG_TABLE_NAME = 'service_records' AND NEW.service_plan_id IS NOT NULL THEN
      SELECT organization_id INTO _other FROM public.service_plans WHERE id = NEW.service_plan_id;
      IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Service plan belongs to a different organization' USING ERRCODE='check_violation'; END IF;
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
END; $$;

DROP TRIGGER IF EXISTS t_org_integrity ON public.properties;
CREATE TRIGGER t_org_integrity BEFORE INSERT OR UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.enforce_org_integrity();
DROP TRIGGER IF EXISTS t_org_integrity ON public.pools;
CREATE TRIGGER t_org_integrity BEFORE INSERT OR UPDATE ON public.pools
FOR EACH ROW EXECUTE FUNCTION public.enforce_org_integrity();
DROP TRIGGER IF EXISTS t_org_integrity ON public.service_plans;
CREATE TRIGGER t_org_integrity BEFORE INSERT OR UPDATE ON public.service_plans
FOR EACH ROW EXECUTE FUNCTION public.enforce_org_integrity();
DROP TRIGGER IF EXISTS t_org_integrity ON public.service_records;
CREATE TRIGGER t_org_integrity BEFORE INSERT OR UPDATE ON public.service_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_org_integrity();
DROP TRIGGER IF EXISTS t_org_integrity ON public.invoices;
CREATE TRIGGER t_org_integrity BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.enforce_org_integrity();
DROP TRIGGER IF EXISTS t_org_integrity ON public.customer_notes;
CREATE TRIGGER t_org_integrity BEFORE INSERT OR UPDATE ON public.customer_notes
FOR EACH ROW EXECUTE FUNCTION public.enforce_org_integrity();
DROP TRIGGER IF EXISTS t_org_integrity ON public.route_days;
CREATE TRIGGER t_org_integrity BEFORE INSERT OR UPDATE ON public.route_days
FOR EACH ROW EXECUTE FUNCTION public.enforce_org_integrity();
DROP TRIGGER IF EXISTS t_org_integrity ON public.route_stops;
CREATE TRIGGER t_org_integrity BEFORE INSERT OR UPDATE ON public.route_stops
FOR EACH ROW EXECUTE FUNCTION public.enforce_org_integrity();
DROP TRIGGER IF EXISTS t_org_integrity ON public.service_checklist_items;
CREATE TRIGGER t_org_integrity BEFORE INSERT OR UPDATE ON public.service_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_org_integrity();
DROP TRIGGER IF EXISTS t_org_integrity ON public.service_chemistry_readings;
CREATE TRIGGER t_org_integrity BEFORE INSERT OR UPDATE ON public.service_chemistry_readings
FOR EACH ROW EXECUTE FUNCTION public.enforce_org_integrity();
DROP TRIGGER IF EXISTS t_org_integrity ON public.service_chemical_usage;
CREATE TRIGGER t_org_integrity BEFORE INSERT OR UPDATE ON public.service_chemical_usage
FOR EACH ROW EXECUTE FUNCTION public.enforce_org_integrity();
DROP TRIGGER IF EXISTS t_org_integrity ON public.service_equipment_observations;
CREATE TRIGGER t_org_integrity BEFORE INSERT OR UPDATE ON public.service_equipment_observations
FOR EACH ROW EXECUTE FUNCTION public.enforce_org_integrity();
DROP TRIGGER IF EXISTS t_org_integrity ON public.service_photos;
CREATE TRIGGER t_org_integrity BEFORE INSERT OR UPDATE ON public.service_photos
FOR EACH ROW EXECUTE FUNCTION public.enforce_org_integrity();

-- invoice_items: parent invoice + optional service plan must match
CREATE OR REPLACE FUNCTION public.enforce_invoice_item_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _other uuid; _status text;
BEGIN
  SELECT organization_id, status INTO _org, _status FROM public.invoices WHERE id = NEW.invoice_id;
  IF _org IS NULL THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE='check_violation'; END IF;
  IF _status = 'void' THEN RAISE EXCEPTION 'Cannot modify items on a voided invoice' USING ERRCODE='check_violation'; END IF;
  IF NEW.quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than zero' USING ERRCODE='check_violation'; END IF;
  IF NEW.unit_price < 0 THEN RAISE EXCEPTION 'Unit price cannot be negative' USING ERRCODE='check_violation'; END IF;
  IF NEW.service_plan_id IS NOT NULL THEN
    SELECT organization_id INTO _other FROM public.service_plans WHERE id = NEW.service_plan_id;
    IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Service plan belongs to a different organization' USING ERRCODE='check_violation'; END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS t_item_integrity ON public.invoice_items;
CREATE TRIGGER t_item_integrity BEFORE INSERT OR UPDATE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_item_integrity();

-- =========================================================
-- 4. Payment validation
-- =========================================================
CREATE OR REPLACE FUNCTION public.validate_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv record; _other uuid; _total numeric; _paid_other numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id is immutable' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero' USING ERRCODE = 'check_violation';
  END IF;

  SELECT organization_id INTO _other FROM public.customers WHERE id = NEW.customer_id;
  IF _other IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Customer belongs to a different organization' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.invoice_id IS NOT NULL THEN
    SELECT id, organization_id, customer_id, status, total INTO _inv
    FROM public.invoices WHERE id = NEW.invoice_id;

    IF _inv.id IS NULL THEN
      RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'check_violation';
    END IF;
    IF _inv.organization_id IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'Invoice belongs to a different organization' USING ERRCODE = 'check_violation';
    END IF;
    IF _inv.customer_id IS DISTINCT FROM NEW.customer_id THEN
      RAISE EXCEPTION 'Payment customer does not match the invoice customer' USING ERRCODE = 'check_violation';
    END IF;
    IF _inv.status = 'void' THEN
      RAISE EXCEPTION 'Cannot record a payment against a voided invoice' USING ERRCODE = 'check_violation';
    END IF;
    IF _inv.status = 'draft' THEN
      RAISE EXCEPTION 'Send the invoice before recording a payment' USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.status = 'completed' AND NOT NEW.allow_overpayment THEN
      _total := _inv.total;
      SELECT coalesce(sum(amount),0) INTO _paid_other FROM public.payments
        WHERE invoice_id = NEW.invoice_id AND status = 'completed' AND id <> NEW.id;
      IF NEW.amount > (_total - _paid_other) + 0.005 THEN
        RAISE EXCEPTION 'Payment of % exceeds the remaining balance of %', NEW.amount, round(_total - _paid_other, 2)
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE UNIQUE INDEX IF NOT EXISTS payments_org_txnref_uidx
  ON public.payments (organization_id, transaction_reference)
  WHERE transaction_reference IS NOT NULL;

-- =========================================================
-- 5. Voided invoices are never collectible
-- =========================================================
CREATE OR REPLACE FUNCTION public.compute_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sub numeric := 0; _paid numeric := 0;
BEGIN
  SELECT coalesce(sum(total),0) INTO _sub FROM public.invoice_items WHERE invoice_id = NEW.id;
  SELECT coalesce(sum(amount),0) INTO _paid FROM public.payments
    WHERE invoice_id = NEW.id AND status = 'completed';

  NEW.subtotal := round(_sub, 2);
  NEW.discount := round(least(coalesce(NEW.discount,0), NEW.subtotal), 2);
  NEW.tax := round((NEW.subtotal - NEW.discount) * coalesce(NEW.tax_rate,0) / 100.0, 2);
  NEW.total := round(NEW.subtotal - NEW.discount + NEW.tax, 2);
  NEW.amount_paid := round(_paid, 2);
  NEW.amount_due := round(NEW.total - NEW.amount_paid, 2);

  IF NEW.status = 'void' THEN
    -- A voided invoice is not a receivable.
    NEW.amount_due := 0;
  ELSIF NEW.status <> 'draft' THEN
    IF NEW.amount_due <= 0 AND NEW.total > 0 THEN NEW.status := 'paid';
    ELSIF NEW.due_date < current_date AND NEW.amount_due > 0 THEN NEW.status := 'overdue';
    ELSIF NEW.amount_paid > 0 AND NEW.amount_due > 0 THEN NEW.status := 'partially_paid';
    ELSE NEW.status := 'sent';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END; $$;

-- =========================================================
-- 6. Financial audit trail
-- =========================================================
CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.financial_audit_log TO authenticated;
GRANT ALL ON public.financial_audit_log TO service_role;

ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fin_audit_select ON public.financial_audit_log;
CREATE POLICY fin_audit_select ON public.financial_audit_log FOR SELECT TO authenticated
USING (organization_id = public.current_org_id() AND public.is_org_admin());

CREATE INDEX IF NOT EXISTS fin_audit_org_created_idx
  ON public.financial_audit_log (organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_financial_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _changes jsonb := '{}'::jsonb; _action text; _row record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _row := OLD; _action := 'deleted';
    _changes := jsonb_build_object('amount', OLD.amount);
  ELSIF TG_OP = 'INSERT' THEN
    _row := NEW; _action := 'created';
    IF TG_TABLE_NAME = 'invoices' THEN
      _changes := jsonb_build_object('invoice_number', NEW.invoice_number, 'total', NEW.total, 'status', NEW.status);
    ELSE
      _changes := jsonb_build_object('amount', NEW.amount, 'invoice_id', NEW.invoice_id, 'method', NEW.payment_method);
    END IF;
  ELSE
    _row := NEW; _action := 'updated';
    IF TG_TABLE_NAME = 'invoices' THEN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        _changes := _changes || jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status));
        IF NEW.status = 'void' THEN _action := 'voided'; END IF;
      END IF;
      IF NEW.total IS DISTINCT FROM OLD.total THEN
        _changes := _changes || jsonb_build_object('total', jsonb_build_array(OLD.total, NEW.total));
      END IF;
      IF NEW.amount_paid IS DISTINCT FROM OLD.amount_paid THEN
        _changes := _changes || jsonb_build_object('amount_paid', jsonb_build_array(OLD.amount_paid, NEW.amount_paid));
      END IF;
    ELSE
      IF NEW.amount IS DISTINCT FROM OLD.amount THEN
        _changes := _changes || jsonb_build_object('amount', jsonb_build_array(OLD.amount, NEW.amount));
      END IF;
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        _changes := _changes || jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status));
      END IF;
    END IF;
    IF _changes = '{}'::jsonb THEN RETURN NULL; END IF;
  END IF;

  INSERT INTO public.financial_audit_log (organization_id, entity_type, entity_id, action, changes, changed_by)
  VALUES (_row.organization_id, TG_TABLE_NAME, _row.id, _action, _changes, auth.uid());
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS t_invoice_audit ON public.invoices;
CREATE TRIGGER t_invoice_audit AFTER INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.log_financial_change();

DROP TRIGGER IF EXISTS t_payment_audit ON public.payments;
CREATE TRIGGER t_payment_audit AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.log_financial_change();

-- =========================================================
-- 7. Self-test: item + payment recalculation (raises on failure)
-- =========================================================
DO $$
DECLARE _org uuid; _cust uuid; _inv uuid; _it1 uuid; _it2 uuid; _pay uuid; _r record;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('__selftest__') RETURNING id INTO _org;
  INSERT INTO public.customers (organization_id, first_name, last_name)
    VALUES (_org, 'Self', 'Test') RETURNING id INTO _cust;
  INSERT INTO public.invoices (organization_id, customer_id, invoice_date, due_date, status)
    VALUES (_org, _cust, current_date, current_date + 15, 'sent') RETURNING id INTO _inv;

  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, position)
    VALUES (_inv, 'Pool Service', 1, 100, 0) RETURNING id INTO _it1;
  SELECT * INTO _r FROM public.invoices WHERE id = _inv;
  IF _r.subtotal <> 100 OR _r.total <> 100 OR _r.amount_due <> 100 THEN
    RAISE EXCEPTION 'item insert recalc failed: %', row_to_json(_r);
  END IF;

  INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, position)
    VALUES (_inv, 'Chemical Service', 1, 50, 1) RETURNING id INTO _it2;
  SELECT * INTO _r FROM public.invoices WHERE id = _inv;
  IF _r.total <> 150 OR _r.amount_due <> 150 THEN RAISE EXCEPTION 'second item failed: %', row_to_json(_r); END IF;

  UPDATE public.invoice_items SET unit_price = 125 WHERE id = _it1;
  SELECT * INTO _r FROM public.invoices WHERE id = _inv;
  IF _r.total <> 175 THEN RAISE EXCEPTION 'item edit failed: %', row_to_json(_r); END IF;

  DELETE FROM public.invoice_items WHERE id = _it2;
  SELECT * INTO _r FROM public.invoices WHERE id = _inv;
  IF _r.total <> 125 OR _r.amount_due <> 125 THEN RAISE EXCEPTION 'item delete failed: %', row_to_json(_r); END IF;

  INSERT INTO public.payments (organization_id, customer_id, invoice_id, payment_date, amount, payment_method, status)
    VALUES (_org, _cust, _inv, current_date, 50, 'check', 'completed');
  SELECT * INTO _r FROM public.invoices WHERE id = _inv;
  IF _r.amount_paid <> 50 OR _r.amount_due <> 75 OR _r.status <> 'partially_paid' THEN
    RAISE EXCEPTION 'payment 1 failed: %', row_to_json(_r);
  END IF;

  INSERT INTO public.payments (organization_id, customer_id, invoice_id, payment_date, amount, payment_method, status)
    VALUES (_org, _cust, _inv, current_date, 75, 'check', 'completed') RETURNING id INTO _pay;
  SELECT * INTO _r FROM public.invoices WHERE id = _inv;
  IF _r.amount_due <> 0 OR _r.status <> 'paid' THEN RAISE EXCEPTION 'payment 2 failed: %', row_to_json(_r); END IF;

  DELETE FROM public.payments WHERE id = _pay;
  SELECT * INTO _r FROM public.invoices WHERE id = _inv;
  IF _r.amount_paid <> 50 OR _r.amount_due <> 75 OR _r.status <> 'partially_paid' THEN
    RAISE EXCEPTION 'payment delete failed: %', row_to_json(_r);
  END IF;

  -- overpayment must be rejected
  BEGIN
    INSERT INTO public.payments (organization_id, customer_id, invoice_id, payment_date, amount, payment_method, status)
      VALUES (_org, _cust, _inv, current_date, 200, 'cash', 'completed');
    RAISE EXCEPTION 'overpayment was not rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- zero/negative payment must be rejected
  BEGIN
    INSERT INTO public.payments (organization_id, customer_id, invoice_id, payment_date, amount, payment_method, status)
      VALUES (_org, _cust, _inv, current_date, 0, 'cash', 'completed');
    RAISE EXCEPTION 'zero payment was not rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- void clears the receivable
  UPDATE public.invoices SET status = 'void' WHERE id = _inv;
  SELECT * INTO _r FROM public.invoices WHERE id = _inv;
  IF _r.amount_due <> 0 OR _r.status <> 'void' THEN RAISE EXCEPTION 'void failed: %', row_to_json(_r); END IF;

  DELETE FROM public.payments WHERE organization_id = _org;
  DELETE FROM public.invoice_items WHERE invoice_id = _inv;
  DELETE FROM public.invoices WHERE organization_id = _org;
  DELETE FROM public.customers WHERE organization_id = _org;
  DELETE FROM public.financial_audit_log WHERE organization_id = _org;
  DELETE FROM public.organizations WHERE id = _org;
END $$;