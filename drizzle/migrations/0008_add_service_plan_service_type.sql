-- Add a Pool / Spa choice to service plans.
-- Additive and nullable: existing plans keep working, and existing rows are
-- backfilled to 'pool' since every plan created so far is pool maintenance.

ALTER TABLE public.service_plans
  ADD COLUMN IF NOT EXISTS service_type text;

ALTER TABLE public.service_plans
  DROP CONSTRAINT IF EXISTS service_plans_service_type_check;

ALTER TABLE public.service_plans
  ADD CONSTRAINT service_plans_service_type_check
  CHECK (service_type IS NULL OR service_type IN ('pool', 'spa'));

COMMENT ON COLUMN public.service_plans.service_type IS
  'What the plan covers: pool or spa. NULL means not specified.';

UPDATE public.service_plans
  SET service_type = 'pool'
  WHERE service_type IS NULL;
