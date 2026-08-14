-- lock down internal trigger/helper functions
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_invoice_number() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_invoice() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_invoice_item() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_invoice() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_payment() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.current_org_id() FROM anon;
REVOKE ALL ON FUNCTION public.is_org_admin() FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;

-- ============ company + owner bootstrap ============
CREATE OR REPLACE FUNCTION public.create_organization(
  p_name text,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_phone text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _org uuid; _existing uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF coalesce(trim(p_name),'') = '' THEN RAISE EXCEPTION 'Company name is required'; END IF;

  SELECT organization_id INTO _existing FROM public.profiles WHERE id = _uid;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  INSERT INTO public.organizations (name, business_name, email)
  VALUES (trim(p_name), trim(p_name), (SELECT email FROM auth.users WHERE id = _uid))
  RETURNING id INTO _org;

  INSERT INTO public.profiles (id, organization_id, first_name, last_name, email, phone)
  VALUES (_uid, _org, p_first_name, p_last_name, (SELECT email FROM auth.users WHERE id = _uid), p_phone)
  ON CONFLICT (id) DO UPDATE SET organization_id = _org,
    first_name = coalesce(EXCLUDED.first_name, public.profiles.first_name),
    last_name = coalesce(EXCLUDED.last_name, public.profiles.last_name);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (_uid, _org, 'owner') ON CONFLICT DO NOTHING;

  RETURN _org;
END; $$;

REVOKE ALL ON FUNCTION public.create_organization(text,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_organization(text,text,text,text) TO authenticated;

-- ============ demo data ============
CREATE OR REPLACE FUNCTION public.reset_demo_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.current_org_id();
BEGIN
  IF _org IS NULL OR NOT public.is_org_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.customers WHERE organization_id = _org AND is_demo = true;
END; $$;

CREATE OR REPLACE FUNCTION public.seed_demo_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _org uuid := public.current_org_id();
  _uid uuid := auth.uid();
  _cust uuid; _prop uuid; _pool uuid; _plan uuid; _inv uuid;
  _rec record; _i int;
BEGIN
  IF _org IS NULL OR NOT public.is_org_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  PERFORM public.reset_demo_data();

  FOR _rec IN
    SELECT * FROM (VALUES
      ('John','Smith',NULL,'john.smith@example.com','(555) 201-3311','182 Canyon Ridge Rd','Boulder','CO','80302',
       'Sunset Residence','182 Canyon Ridge Rd','Boulder','CO','80302','Gate on the left side of the driveway','4821',
       'Backyard Pool','chlorine',18000,'plaster','Weekly Full Service','weekly',165.00,'monthly'),
      ('Sarah','Johnson',NULL,'sarah.j@example.com','(555) 447-9922','54 Willow Bend Ct','Longmont','CO','80501',
       'Willow Bend Home','54 Willow Bend Ct','Longmont','CO','80501','Dog in yard, ring bell first','1190',
       'Main Pool','salt',24000,'pebble','Bi-Weekly Maintenance','biweekly',140.00,'monthly'),
      ('Robert','Williams','Williams Property Group','rw@example.com','(555) 882-0140','900 Foothill Pkwy','Fort Collins','CO','80525',
       'Foothill Clubhouse','900 Foothill Pkwy','Fort Collins','CO','80525','Use service entrance at rear','7305',
       'Community Pool','chlorine',42000,'tile','Commercial Weekly Service','weekly',420.00,'monthly')
    ) AS t(fn,ln,co,em,ph,ba,bc,bs,bz,pn,pa,pc,ps,pz,an,gc,pln,ptype,pvol,psurf,sname,sfreq,sprice,sbill)
  LOOP
    INSERT INTO public.customers (organization_id,first_name,last_name,company_name,email,phone,
      billing_address,billing_city,billing_state,billing_zip,notes,is_demo)
    VALUES (_org,_rec.fn,_rec.ln,_rec.co,_rec.em,_rec.ph,_rec.ba,_rec.bc,_rec.bs,_rec.bz,'Demo customer record.',true)
    RETURNING id INTO _cust;

    INSERT INTO public.properties (organization_id,customer_id,property_name,address,city,state,zip,access_notes,gate_code)
    VALUES (_org,_cust,_rec.pn,_rec.pa,_rec.pc,_rec.ps,_rec.pz,_rec.an,_rec.gc)
    RETURNING id INTO _prop;

    INSERT INTO public.pools (organization_id,property_id,pool_name,pool_type,approximate_volume,surface_type,equipment_notes)
    VALUES (_org,_prop,_rec.pln,_rec.ptype,_rec.pvol,_rec.psurf,'Variable speed pump, cartridge filter.')
    RETURNING id INTO _pool;

    INSERT INTO public.service_plans (organization_id,customer_id,property_id,pool_id,service_name,description,
      frequency,price,billing_frequency,next_service_date)
    VALUES (_org,_cust,_prop,_pool,_rec.sname,'Skim, brush, vacuum, filter check and chemical balance.',
      _rec.sfreq,_rec.sprice,_rec.sbill, current_date + 3)
    RETURNING id INTO _plan;

    FOR _i IN 1..6 LOOP
      INSERT INTO public.service_records (organization_id,customer_id,property_id,pool_id,service_plan_id,
        service_date,technician_id,status,notes,customer_visible_notes)
      VALUES (_org,_cust,_prop,_pool,_plan, current_date - (_i * 7),
        _uid,
        CASE WHEN _i = 1 THEN 'completed' WHEN _i = 4 THEN 'skipped' ELSE 'completed' END,
        'Routine visit completed.','Pool serviced and chemicals balanced.');
    END LOOP;

    INSERT INTO public.service_records (organization_id,customer_id,property_id,pool_id,service_plan_id,
      service_date,status,notes)
    VALUES (_org,_cust,_prop,_pool,_plan, current_date + 3,'scheduled','Upcoming scheduled visit.');

    -- paid invoice from last month
    INSERT INTO public.invoices (organization_id,customer_id,property_id,invoice_date,due_date,tax_rate,status,notes)
    VALUES (_org,_cust,_prop, current_date - 35, current_date - 20, 0, 'sent','Thank you for your business.')
    RETURNING id INTO _inv;
    INSERT INTO public.invoice_items (invoice_id,service_plan_id,description,quantity,unit_price,position)
    VALUES (_inv,_plan,_rec.sname || ' - monthly service',4,_rec.sprice / 4,0);
    INSERT INTO public.payments (organization_id,customer_id,invoice_id,payment_date,amount,payment_method,status,transaction_reference)
    SELECT _org,_cust,_inv, current_date - 25, total,'check','completed','DEMO-CHK-'||substr(_inv::text,1,4)
    FROM public.invoices WHERE id = _inv;

    -- open invoice, partially paid
    INSERT INTO public.invoices (organization_id,customer_id,property_id,invoice_date,due_date,tax_rate,status,notes)
    VALUES (_org,_cust,_prop, current_date - 10, current_date + 5, 0, 'sent','Current period service.')
    RETURNING id INTO _inv;
    INSERT INTO public.invoice_items (invoice_id,service_plan_id,description,quantity,unit_price,position)
    VALUES (_inv,_plan,_rec.sname || ' - monthly service',4,_rec.sprice / 4,0);
    INSERT INTO public.invoice_items (invoice_id,description,quantity,unit_price,position)
    VALUES (_inv,'Filter cartridge replacement',1,89.00,1);
    INSERT INTO public.payments (organization_id,customer_id,invoice_id,payment_date,amount,payment_method,status)
    SELECT _org,_cust,_inv, current_date - 4, round(total / 3, 2),'credit_card','completed'
    FROM public.invoices WHERE id = _inv;

    -- overdue invoice
    INSERT INTO public.invoices (organization_id,customer_id,property_id,invoice_date,due_date,tax_rate,status)
    VALUES (_org,_cust,_prop, current_date - 60, current_date - 45, 0, 'sent')
    RETURNING id INTO _inv;
    INSERT INTO public.invoice_items (invoice_id,description,quantity,unit_price,position)
    VALUES (_inv,'Equipment repair labor',2,95.00,0);
  END LOOP;
END; $$;

REVOKE ALL ON FUNCTION public.seed_demo_data() FROM anon;
REVOKE ALL ON FUNCTION public.reset_demo_data() FROM anon;
GRANT EXECUTE ON FUNCTION public.seed_demo_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO authenticated;
