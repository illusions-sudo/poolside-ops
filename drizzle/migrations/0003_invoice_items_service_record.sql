ALTER TABLE public.invoice_items ADD COLUMN service_record_id uuid REFERENCES public.service_records(id) ON DELETE SET NULL;
CREATE INDEX invoice_items_service_record_idx ON public.invoice_items(service_record_id);

CREATE OR REPLACE FUNCTION public.check_invoice_item_service_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.service_record_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM service_records sr JOIN invoices i ON i.id = NEW.invoice_id
    WHERE sr.id = NEW.service_record_id AND sr.organization_id = i.organization_id
      AND sr.customer_id = i.customer_id
  ) THEN
    RAISE EXCEPTION 'That visit does not belong to this invoice''s customer.';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_invoice_item_service_record() FROM PUBLIC;
CREATE TRIGGER check_invoice_item_service_record BEFORE INSERT OR UPDATE OF service_record_id ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.check_invoice_item_service_record();