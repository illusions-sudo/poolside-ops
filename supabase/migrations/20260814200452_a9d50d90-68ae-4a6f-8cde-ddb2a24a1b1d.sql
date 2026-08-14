-- 1. SERVICE PLAN ASSIGNMENT FIELDS
ALTER TABLE public.service_plans
  ADD COLUMN IF NOT EXISTS technician_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_day smallint,
  ADD COLUMN IF NOT EXISTS preferred_window_start time,
  ADD COLUMN IF NOT EXISTS preferred_window_end time,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS custom_interval_days integer;

ALTER TABLE public.service_plans DROP CONSTRAINT IF EXISTS service_plans_preferred_day_chk;
ALTER TABLE public.service_plans ADD CONSTRAINT service_plans_preferred_day_chk
  CHECK (preferred_day IS NULL OR (preferred_day BETWEEN 0 AND 6));

-- 2. SERVICE RECORD FIELD-WORK FIELDS
ALTER TABLE public.service_records
  ADD COLUMN IF NOT EXISTS scheduled_time time,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS skip_reason text,
  ADD COLUMN IF NOT EXISTS skip_note text,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

ALTER TABLE public.service_records DROP CONSTRAINT IF EXISTS service_records_status_chk;
ALTER TABLE public.service_records ADD CONSTRAINT service_records_status_chk
  CHECK (status = ANY (ARRAY['scheduled','en_route','in_progress','completed','cancelled','skipped']));

CREATE INDEX IF NOT EXISTS idx_sr_org_date ON public.service_records(organization_id, service_date);
CREATE INDEX IF NOT EXISTS idx_sr_tech_date ON public.service_records(technician_id, service_date);
CREATE INDEX IF NOT EXISTS idx_sr_customer ON public.service_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_sr_property ON public.service_records(property_id);
CREATE INDEX IF NOT EXISTS idx_sr_pool ON public.service_records(pool_id);
CREATE INDEX IF NOT EXISTS idx_sr_plan ON public.service_records(service_plan_id);
CREATE INDEX IF NOT EXISTS idx_sp_tech ON public.service_plans(technician_id);
CREATE INDEX IF NOT EXISTS idx_sp_org_status ON public.service_plans(organization_id, status);

DROP POLICY IF EXISTS records_select ON public.service_records;
CREATE POLICY records_select ON public.service_records FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id()
     AND (public.is_org_admin() OR technician_id = auth.uid() OR technician_id IS NULL));

DROP POLICY IF EXISTS records_write ON public.service_records;
CREATE POLICY records_update ON public.service_records FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id()
     AND (public.is_org_admin() OR technician_id = auth.uid() OR technician_id IS NULL))
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY records_insert ON public.service_records FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY records_delete ON public.service_records FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_admin());

CREATE OR REPLACE FUNCTION public.can_access_service(_service_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_records r
    WHERE r.id = _service_id
      AND r.organization_id = public.current_org_id()
      AND (public.is_org_admin() OR r.technician_id = auth.uid() OR r.technician_id IS NULL)
  )
$$;

-- 3. ROUTES
CREATE TABLE IF NOT EXISTS public.route_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  technician_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  route_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, technician_id, route_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_days TO authenticated;
GRANT ALL ON public.route_days TO service_role;
ALTER TABLE public.route_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY route_days_select ON public.route_days FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id()
     AND (public.is_org_admin() OR technician_id = auth.uid()));
CREATE POLICY route_days_write ON public.route_days FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());
CREATE TRIGGER t_route_days_upd BEFORE UPDATE ON public.route_days
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_route_days_org_date ON public.route_days(organization_id, route_date);
CREATE INDEX IF NOT EXISTS idx_route_days_tech ON public.route_days(technician_id);

CREATE TABLE IF NOT EXISTS public.route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  route_day_id uuid NOT NULL REFERENCES public.route_days(id) ON DELETE CASCADE,
  service_record_id uuid NOT NULL REFERENCES public.service_records(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_record_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_stops TO authenticated;
GRANT ALL ON public.route_stops TO service_role;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY route_stops_select ON public.route_stops FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY route_stops_write ON public.route_stops FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_admin())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());
CREATE INDEX IF NOT EXISTS idx_route_stops_day ON public.route_stops(route_day_id, position);

-- 4. CHECKLIST
CREATE TABLE IF NOT EXISTS public.service_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_record_id uuid NOT NULL REFERENCES public.service_records(id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_checklist_items TO authenticated;
GRANT ALL ON public.service_checklist_items TO service_role;
ALTER TABLE public.service_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY checklist_select ON public.service_checklist_items FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_service(service_record_id));
CREATE POLICY checklist_write ON public.service_checklist_items FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_service(service_record_id))
  WITH CHECK (organization_id = public.current_org_id() AND public.can_access_service(service_record_id));
CREATE INDEX IF NOT EXISTS idx_checklist_service ON public.service_checklist_items(service_record_id, position);

-- 5. WATER CHEMISTRY
CREATE TABLE IF NOT EXISTS public.service_chemistry_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_record_id uuid NOT NULL REFERENCES public.service_records(id) ON DELETE CASCADE,
  pool_id uuid REFERENCES public.pools(id) ON DELETE SET NULL,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reading_date date NOT NULL DEFAULT CURRENT_DATE,
  free_chlorine numeric,
  total_chlorine numeric,
  ph numeric,
  alkalinity numeric,
  calcium_hardness numeric,
  cyanuric_acid numeric,
  salt numeric,
  water_temperature numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_chemistry_readings TO authenticated;
GRANT ALL ON public.service_chemistry_readings TO service_role;
ALTER TABLE public.service_chemistry_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY chem_read_select ON public.service_chemistry_readings FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY chem_read_write ON public.service_chemistry_readings FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_service(service_record_id))
  WITH CHECK (organization_id = public.current_org_id() AND public.can_access_service(service_record_id));
CREATE TRIGGER t_chem_read_upd BEFORE UPDATE ON public.service_chemistry_readings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_chem_service ON public.service_chemistry_readings(service_record_id);
CREATE INDEX IF NOT EXISTS idx_chem_pool_date ON public.service_chemistry_readings(pool_id, reading_date DESC);

-- 6. CHEMICALS ADDED
CREATE TABLE IF NOT EXISTS public.service_chemical_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_record_id uuid NOT NULL REFERENCES public.service_records(id) ON DELETE CASCADE,
  pool_id uuid REFERENCES public.pools(id) ON DELETE SET NULL,
  chemical_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'gallons',
  notes text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_chemical_usage TO authenticated;
GRANT ALL ON public.service_chemical_usage TO service_role;
ALTER TABLE public.service_chemical_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY chem_use_select ON public.service_chemical_usage FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY chem_use_write ON public.service_chemical_usage FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_service(service_record_id))
  WITH CHECK (organization_id = public.current_org_id() AND public.can_access_service(service_record_id));
CREATE INDEX IF NOT EXISTS idx_chemuse_service ON public.service_chemical_usage(service_record_id);

-- 7. EQUIPMENT OBSERVATIONS
CREATE TABLE IF NOT EXISTS public.service_equipment_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_record_id uuid NOT NULL REFERENCES public.service_records(id) ON DELETE CASCADE,
  pool_id uuid REFERENCES public.pools(id) ON DELETE SET NULL,
  equipment_type text NOT NULL,
  condition text NOT NULL DEFAULT 'good',
  notes text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equip_condition_chk CHECK (condition = ANY (ARRAY['good','attention','problem','not_checked']))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_equipment_observations TO authenticated;
GRANT ALL ON public.service_equipment_observations TO service_role;
ALTER TABLE public.service_equipment_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY equip_select ON public.service_equipment_observations FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY equip_write ON public.service_equipment_observations FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_access_service(service_record_id))
  WITH CHECK (organization_id = public.current_org_id() AND public.can_access_service(service_record_id));
CREATE INDEX IF NOT EXISTS idx_equip_service ON public.service_equipment_observations(service_record_id);
CREATE INDEX IF NOT EXISTS idx_equip_pool ON public.service_equipment_observations(pool_id);

-- 8. SERVICE PHOTOS
CREATE TABLE IF NOT EXISTS public.service_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_record_id uuid NOT NULL REFERENCES public.service_records(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  pool_id uuid REFERENCES public.pools(id) ON DELETE SET NULL,
  technician_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_photos TO authenticated;
GRANT ALL ON public.service_photos TO service_role;
ALTER TABLE public.service_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY photos_select ON public.service_photos FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY photos_insert ON public.service_photos FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND public.can_access_service(service_record_id));
CREATE POLICY photos_delete ON public.service_photos FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id()
     AND (public.is_org_admin() OR technician_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_photos_service ON public.service_photos(service_record_id);
CREATE INDEX IF NOT EXISTS idx_photos_property ON public.service_photos(property_id, created_at DESC);

-- 9. AUDIT LOG
CREATE TABLE IF NOT EXISTS public.service_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_record_id uuid NOT NULL REFERENCES public.service_records(id) ON DELETE CASCADE,
  changed_by uuid,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_audit_log TO authenticated;
GRANT ALL ON public.service_audit_log TO service_role;
ALTER TABLE public.service_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_select ON public.service_audit_log FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_org_admin());
CREATE INDEX IF NOT EXISTS idx_audit_service ON public.service_audit_log(service_record_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_service_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _changes jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.service_audit_log (organization_id, service_record_id, changed_by, action, changes)
    VALUES (NEW.organization_id, NEW.id, auth.uid(), 'created',
      jsonb_build_object('service_date', NEW.service_date, 'status', NEW.status, 'technician_id', NEW.technician_id));
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    _changes := _changes || jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status));
  END IF;
  IF NEW.technician_id IS DISTINCT FROM OLD.technician_id THEN
    _changes := _changes || jsonb_build_object('technician_id', jsonb_build_array(OLD.technician_id, NEW.technician_id));
  END IF;
  IF NEW.service_date IS DISTINCT FROM OLD.service_date THEN
    _changes := _changes || jsonb_build_object('service_date', jsonb_build_array(OLD.service_date, NEW.service_date));
  END IF;
  IF _changes <> '{}'::jsonb THEN
    INSERT INTO public.service_audit_log (organization_id, service_record_id, changed_by, action, changes)
    VALUES (NEW.organization_id, NEW.id, auth.uid(), 'updated', _changes);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS t_service_audit ON public.service_records;
CREATE TRIGGER t_service_audit AFTER INSERT OR UPDATE ON public.service_records
  FOR EACH ROW EXECUTE FUNCTION public.log_service_change();

-- 10. DEFAULT CHECKLIST ON NEW SERVICE RECORDS
CREATE OR REPLACE FUNCTION public.seed_service_checklist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _labels text[] := ARRAY['Skim pool','Brush pool','Vacuum pool','Empty baskets','Check filter',
  'Check pump','Check water level','Check equipment','Test water','Add chemicals if necessary'];
  _i int;
BEGIN
  FOR _i IN 1..array_length(_labels,1) LOOP
    INSERT INTO public.service_checklist_items (organization_id, service_record_id, label, position)
    VALUES (NEW.organization_id, NEW.id, _labels[_i], _i - 1);
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS t_service_checklist ON public.service_records;
CREATE TRIGGER t_service_checklist AFTER INSERT ON public.service_records
  FOR EACH ROW EXECUTE FUNCTION public.seed_service_checklist();

-- 11. RECURRING SERVICE GENERATION
CREATE OR REPLACE FUNCTION public.generate_service_records(p_weeks integer DEFAULT 4)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _org uuid := public.current_org_id();
  _plan record; _d date; _horizon date; _step int; _created int := 0; _start date;
BEGIN
  IF _org IS NULL OR NOT public.is_org_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  p_weeks := least(greatest(coalesce(p_weeks,4), 1), 8);
  _horizon := current_date + (p_weeks * 7);

  FOR _plan IN
    SELECT * FROM public.service_plans
    WHERE organization_id = _org AND status = 'active' AND active = true AND frequency <> 'one_time'
  LOOP
    _step := CASE _plan.frequency
      WHEN 'weekly' THEN 7 WHEN 'biweekly' THEN 14 WHEN 'monthly' THEN 28
      ELSE greatest(coalesce(_plan.custom_interval_days, 7), 1) END;

    _start := greatest(coalesce(_plan.next_service_date, current_date), current_date);
    IF _plan.preferred_day IS NOT NULL THEN
      _start := _start + ((_plan.preferred_day - extract(dow from _start)::int + 7) % 7);
    END IF;

    _d := _start;
    WHILE _d <= _horizon LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.service_records r
        WHERE r.service_plan_id = _plan.id AND r.service_date = _d
          AND r.status <> 'cancelled'
      ) THEN
        INSERT INTO public.service_records (organization_id, customer_id, property_id, pool_id,
          service_plan_id, service_date, technician_id, status, scheduled_time, estimated_duration_minutes)
        VALUES (_org, _plan.customer_id, _plan.property_id, _plan.pool_id, _plan.id, _d,
          _plan.technician_id, 'scheduled', _plan.preferred_window_start,
          coalesce(_plan.estimated_duration_minutes, 45));
        _created := _created + 1;
      END IF;
      _d := _d + _step;
    END LOOP;

    UPDATE public.service_plans SET next_service_date = _start WHERE id = _plan.id;
  END LOOP;

  RETURN _created;
END; $$;

REVOKE ALL ON FUNCTION public.generate_service_records(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_service_records(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.can_access_service(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_service(uuid) TO authenticated;

-- 12. ROUTE ORDER SAVE HELPER
CREATE OR REPLACE FUNCTION public.save_route_order(p_route_day_id uuid, p_service_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid := public.current_org_id(); _i int;
BEGIN
  IF _org IS NULL OR NOT public.is_org_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.route_days WHERE id = p_route_day_id AND organization_id = _org) THEN
    RAISE EXCEPTION 'Route not found';
  END IF;
  FOR _i IN 1..coalesce(array_length(p_service_ids,1),0) LOOP
    INSERT INTO public.route_stops (organization_id, route_day_id, service_record_id, position)
    VALUES (_org, p_route_day_id, p_service_ids[_i], _i - 1)
    ON CONFLICT (service_record_id) DO UPDATE
      SET route_day_id = excluded.route_day_id, position = excluded.position;
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.save_route_order(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_route_order(uuid, uuid[]) TO authenticated;

-- 13. PHOTO STORAGE POLICIES (bucket: service-photos, private, org-scoped folder)
DROP POLICY IF EXISTS "service photos read" ON storage.objects;
CREATE POLICY "service photos read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'service-photos' AND (storage.foldername(name))[1] = public.current_org_id()::text);
DROP POLICY IF EXISTS "service photos insert" ON storage.objects;
CREATE POLICY "service photos insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-photos' AND (storage.foldername(name))[1] = public.current_org_id()::text);
DROP POLICY IF EXISTS "service photos delete" ON storage.objects;
CREATE POLICY "service photos delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'service-photos' AND (storage.foldername(name))[1] = public.current_org_id()::text);
