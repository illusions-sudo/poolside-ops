-- ============ enums ============
CREATE TYPE public.app_role AS ENUM ('owner','admin','employee');

-- ============ helper: updated_at ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ organizations ============
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_name text,
  email text,
  phone text,
  website text,
  address text,
  city text,
  state text,
  zip text,
  logo_url text,
  invoice_prefix text NOT NULL DEFAULT 'INV-',
  next_invoice_number integer NOT NULL DEFAULT 1001,
  default_tax_rate numeric(6,3) NOT NULL DEFAULT 0,
  default_payment_terms integer NOT NULL DEFAULT 15,
  default_invoice_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_org_idx ON public.profiles(organization_id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, role)
);
CREATE INDEX user_roles_user_idx ON public.user_roles(user_id);

-- ============ security definer helpers ============
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND active = true
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  )
$$;

-- ============ customers ============
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  company_name text,
  email text,
  phone text,
  alternate_phone text,
  billing_address text,
  billing_city text,
  billing_state text,
  billing_zip text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_org_idx ON public.customers(organization_id);
CREATE INDEX customers_name_idx ON public.customers(organization_id, last_name, first_name);

CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  property_name text,
  address text NOT NULL,
  city text,
  state text,
  zip text,
  access_notes text,
  gate_code text,
  property_notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX properties_org_idx ON public.properties(organization_id);
CREATE INDEX properties_customer_idx ON public.properties(customer_id);

CREATE TABLE public.pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  pool_name text,
  pool_type text,
  approximate_volume integer,
  surface_type text,
  equipment_notes text,
  special_instructions text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pools_org_idx ON public.pools(organization_id);
CREATE INDEX pools_property_idx ON public.pools(property_id);

CREATE TABLE public.service_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  pool_id uuid REFERENCES public.pools(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  description text,
  frequency text NOT NULL DEFAULT 'weekly',
  price numeric(12,2) NOT NULL DEFAULT 0,
  billing_frequency text NOT NULL DEFAULT 'monthly',
  next_service_date date,
  status text NOT NULL DEFAULT 'active',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_plans_frequency_chk CHECK (frequency IN ('weekly','biweekly','monthly','one_time','custom')),
  CONSTRAINT service_plans_billing_chk CHECK (billing_frequency IN ('per_service','weekly','monthly','quarterly','annually','one_time')),
  CONSTRAINT service_plans_status_chk CHECK (status IN ('active','paused','cancelled'))
);
CREATE INDEX service_plans_org_idx ON public.service_plans(organization_id);
CREATE INDEX service_plans_customer_idx ON public.service_plans(customer_id);
CREATE INDEX service_plans_next_idx ON public.service_plans(organization_id, next_service_date);

CREATE TABLE public.service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  pool_id uuid REFERENCES public.pools(id) ON DELETE SET NULL,
  service_plan_id uuid REFERENCES public.service_plans(id) ON DELETE SET NULL,
  service_date date NOT NULL DEFAULT current_date,
  technician_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  customer_visible_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_records_status_chk CHECK (status IN ('scheduled','completed','cancelled','skipped'))
);
CREATE INDEX service_records_org_date_idx ON public.service_records(organization_id, service_date DESC);
CREATE INDEX service_records_customer_idx ON public.service_records(customer_id);
CREATE INDEX service_records_property_idx ON public.service_records(property_id);

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT current_date,
  due_date date NOT NULL DEFAULT (current_date + 15),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(6,3) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  amount_due numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_status_chk CHECK (status IN ('draft','sent','paid','partially_paid','overdue','void'))
);
CREATE UNIQUE INDEX invoices_org_number_uidx ON public.invoices(organization_id, invoice_number);
CREATE INDEX invoices_customer_idx ON public.invoices(customer_id);
CREATE INDEX invoices_org_status_idx ON public.invoices(organization_id, status);

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  service_plan_id uuid REFERENCES public.service_plans(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoice_items_invoice_idx ON public.invoice_items(invoice_id);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT current_date,
  amount numeric(12,2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  transaction_reference text,
  notes text,
  status text NOT NULL DEFAULT 'completed',
  allow_overpayment boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_method_chk CHECK (payment_method IN ('cash','check','credit_card','ach','other')),
  CONSTRAINT payments_status_chk CHECK (status IN ('pending','completed','failed','refunded')),
  CONSTRAINT payments_amount_chk CHECK (amount > 0)
);
CREATE INDEX payments_org_date_idx ON public.payments(organization_id, payment_date DESC);
CREATE INDEX payments_invoice_idx ON public.payments(invoice_id);
CREATE INDEX payments_customer_idx ON public.payments(customer_id);

CREATE TABLE public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  note text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_notes_customer_idx ON public.customer_notes(customer_id);

-- ============ updated_at triggers ============
CREATE TRIGGER t_org_upd BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_customers_upd BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_properties_upd BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_pools_upd BEFORE UPDATE ON public.pools FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_plans_upd BEFORE UPDATE ON public.service_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_records_upd BEFORE UPDATE ON public.service_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_notes_upd BEFORE UPDATE ON public.customer_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ invoice numbering ============
CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prefix text; _num integer;
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    UPDATE public.organizations
      SET next_invoice_number = next_invoice_number + 1
      WHERE id = NEW.organization_id
      RETURNING invoice_prefix, next_invoice_number - 1 INTO _prefix, _num;
    NEW.invoice_number := coalesce(_prefix,'INV-') || _num::text;
  END IF;
  RETURN NEW;
END; $$;

-- ============ invoice line item totals ============
CREATE OR REPLACE FUNCTION public.compute_invoice_item()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.total := round(coalesce(NEW.quantity,0) * coalesce(NEW.unit_price,0), 2);
  RETURN NEW;
END; $$;

CREATE TRIGGER t_invoice_item_compute BEFORE INSERT OR UPDATE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.compute_invoice_item();

-- ============ invoice recalculation (BEFORE trigger, no recursion) ============
CREATE OR REPLACE FUNCTION public.compute_invoice()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sub numeric := 0; _paid numeric := 0;
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'INSERT' THEN
    SELECT coalesce(sum(total),0) INTO _sub FROM public.invoice_items WHERE invoice_id = NEW.id;
    SELECT coalesce(sum(amount),0) INTO _paid FROM public.payments WHERE invoice_id = NEW.id AND status = 'completed';
  END IF;
  NEW.subtotal := round(_sub, 2);
  NEW.discount := round(least(coalesce(NEW.discount,0), NEW.subtotal), 2);
  NEW.tax := round((NEW.subtotal - NEW.discount) * coalesce(NEW.tax_rate,0) / 100.0, 2);
  NEW.total := round(NEW.subtotal - NEW.discount + NEW.tax, 2);
  NEW.amount_paid := round(_paid, 2);
  NEW.amount_due := round(NEW.total - NEW.amount_paid, 2);
  IF NEW.status NOT IN ('draft','void') THEN
    IF NEW.amount_due <= 0 AND NEW.total > 0 THEN NEW.status := 'paid';
    ELSIF NEW.due_date < current_date AND NEW.amount_due > 0 THEN NEW.status := 'overdue';
    ELSIF NEW.amount_paid > 0 AND NEW.amount_due > 0 THEN NEW.status := 'partially_paid';
    ELSE NEW.status := 'sent';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER t_a_invoice_number BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.assign_invoice_number();
CREATE TRIGGER t_b_invoice_compute BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.compute_invoice();

CREATE OR REPLACE FUNCTION public.touch_invoice()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  _id := coalesce(NEW.invoice_id, OLD.invoice_id);
  IF _id IS NOT NULL THEN
    UPDATE public.invoices SET updated_at = now() WHERE id = _id;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER t_items_touch AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.touch_invoice();
CREATE TRIGGER t_payments_touch AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.touch_invoice();

-- ============ payment validation ============
CREATE OR REPLACE FUNCTION public.validate_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _due numeric; _other numeric;
BEGIN
  IF NEW.invoice_id IS NOT NULL AND NEW.status = 'completed' AND NOT NEW.allow_overpayment THEN
    SELECT total INTO _due FROM public.invoices WHERE id = NEW.invoice_id;
    SELECT coalesce(sum(amount),0) INTO _other FROM public.payments
      WHERE invoice_id = NEW.invoice_id AND status = 'completed' AND id <> NEW.id;
    IF NEW.amount > (_due - _other) + 0.005 THEN
      RAISE EXCEPTION 'Payment of % exceeds the remaining balance of %', NEW.amount, round(_due - _other, 2)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER t_payment_validate BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.validate_payment();

-- ============ grants ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pools TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notes TO authenticated;
GRANT ALL ON public.organizations, public.profiles, public.user_roles, public.customers,
  public.properties, public.pools, public.service_plans, public.service_records,
  public.invoices, public.invoice_items, public.payments, public.customer_notes TO service_role;

-- ============ RLS ============
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_select ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_org_id());
CREATE POLICY org_update ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY profiles_select_self ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR organization_id = public.current_org_id());
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR (organization_id = public.current_org_id() AND public.is_org_admin()))
  WITH CHECK (id = auth.uid() OR (organization_id = public.current_org_id() AND public.is_org_admin()));

CREATE POLICY roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR organization_id = public.current_org_id());
CREATE POLICY roles_admin_write ON public.user_roles FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

-- tenant tables: read for all members, write for admins
CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY customers_write ON public.customers FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY properties_select ON public.properties FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY properties_write ON public.properties FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY pools_select ON public.pools FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY pools_write ON public.pools FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY plans_select ON public.service_plans FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY plans_write ON public.service_plans FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

-- service records: any member of the org may create/update
CREATE POLICY records_select ON public.service_records FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY records_write ON public.service_records FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY invoices_write ON public.invoices FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY items_select ON public.invoice_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.organization_id = public.current_org_id()));
CREATE POLICY items_write ON public.invoice_items FOR ALL TO authenticated
  USING (public.is_org_admin() AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.organization_id = public.current_org_id()))
  WITH CHECK (public.is_org_admin() AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.organization_id = public.current_org_id()));

CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY payments_write ON public.payments FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

CREATE POLICY cnotes_select ON public.customer_notes FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY cnotes_write ON public.customer_notes FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
