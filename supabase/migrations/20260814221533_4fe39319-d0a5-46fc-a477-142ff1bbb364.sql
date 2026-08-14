-- 1. Invoice lifecycle guard -------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_invoice_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Trusted server-side processes (no JWT) are not restricted.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF OLD.status = 'void' THEN
    IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.property_id IS DISTINCT FROM OLD.property_id
       OR NEW.invoice_date IS DISTINCT FROM OLD.invoice_date
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.tax_rate IS DISTINCT FROM OLD.tax_rate
       OR NEW.discount IS DISTINCT FROM OLD.discount
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
      RAISE EXCEPTION 'This invoice has been voided and can no longer be changed'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'paid' AND NEW.status <> 'void' THEN
    IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.property_id IS DISTINCT FROM OLD.property_id
       OR NEW.tax_rate IS DISTINCT FROM OLD.tax_rate
       OR NEW.discount IS DISTINCT FROM OLD.discount
       OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
      RAISE EXCEPTION 'This invoice is fully paid; financial details can no longer be changed'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.guard_invoice_update() FROM PUBLIC;

DROP TRIGGER IF EXISTS t_c_guard_invoice_update ON public.invoices;
CREATE TRIGGER t_c_guard_invoice_update
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_update();

-- 2. Line items are locked once the invoice is paid or voided -----------------
CREATE OR REPLACE FUNCTION public.enforce_invoice_item_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _org uuid; _other uuid; _status text;
BEGIN
  SELECT organization_id, status INTO _org, _status FROM public.invoices WHERE id = NEW.invoice_id;
  IF _org IS NULL THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE='check_violation'; END IF;
  IF _status = 'void' THEN RAISE EXCEPTION 'Cannot modify items on a voided invoice' USING ERRCODE='check_violation'; END IF;
  IF _status = 'paid' AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify items on a fully paid invoice' USING ERRCODE='check_violation';
  END IF;
  IF NEW.quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than zero' USING ERRCODE='check_violation'; END IF;
  IF NEW.unit_price < 0 THEN RAISE EXCEPTION 'Unit price cannot be negative' USING ERRCODE='check_violation'; END IF;
  IF NEW.service_plan_id IS NOT NULL THEN
    SELECT organization_id INTO _other FROM public.service_plans WHERE id = NEW.service_plan_id;
    IF _other IS DISTINCT FROM _org THEN RAISE EXCEPTION 'Service plan belongs to a different organization' USING ERRCODE='check_violation'; END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.guard_invoice_item_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _status text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN OLD; END IF;
  SELECT status INTO _status FROM public.invoices WHERE id = OLD.invoice_id;
  IF _status = 'void' THEN
    RAISE EXCEPTION 'Cannot modify items on a voided invoice' USING ERRCODE='check_violation';
  END IF;
  IF _status = 'paid' THEN
    RAISE EXCEPTION 'Cannot modify items on a fully paid invoice' USING ERRCODE='check_violation';
  END IF;
  RETURN OLD;
END; $$;

REVOKE ALL ON FUNCTION public.guard_invoice_item_delete() FROM PUBLIC;

DROP TRIGGER IF EXISTS t_item_delete_guard ON public.invoice_items;
CREATE TRIGGER t_item_delete_guard
  BEFORE DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_item_delete();

-- 3. Overpayment flag is reserved for trusted server-side processes -----------
CREATE OR REPLACE FUNCTION public.validate_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _inv record; _other uuid; _total numeric; _paid_other numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id is immutable' USING ERRCODE = 'check_violation';
  END IF;

  -- Any request carrying a user session can never bypass overpayment checks.
  IF auth.uid() IS NOT NULL THEN
    NEW.allow_overpayment := false;
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
