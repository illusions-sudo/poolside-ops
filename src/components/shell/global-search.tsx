import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { customerName, money, shortDate } from "@/lib/format";

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 220);
    return () => clearTimeout(id);
  }, [term]);

  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debounced],
    enabled: open && debounced.length >= 2,
    queryFn: async () => {
      const like = `%${debounced}%`;
      const [customers, properties, invoices, plans] = await Promise.all([
        supabase
          .from("customers")
          .select("id, first_name, last_name, company_name, email")
          .or(
            `first_name.ilike.${like},last_name.ilike.${like},company_name.ilike.${like},email.ilike.${like}`,
          )
          .limit(6),
        supabase
          .from("properties")
          .select("id, property_name, address, city")
          .or(`property_name.ilike.${like},address.ilike.${like},city.ilike.${like}`)
          .limit(6),
        supabase
          .from("invoices")
          .select("id, invoice_number, total, invoice_date")
          .ilike("invoice_number", like)
          .limit(6),
        supabase
          .from("service_plans")
          .select("id, service_name, frequency")
          .ilike("service_name", like)
          .limit(6),
      ]);
      return {
        customers: customers.data ?? [],
        properties: properties.data ?? [],
        invoices: invoices.data ?? [],
        plans: plans.data ?? [],
      };
    },
  });

  const go = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const nothing =
    debounced.length >= 2 &&
    !isFetching &&
    data &&
    !data.customers.length &&
    !data.properties.length &&
    !data.invoices.length &&
    !data.plans.length;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search customers, properties, invoice numbers, service plans…"
        value={term}
        onValueChange={setTerm}
      />
      <CommandList>
        {debounced.length < 2 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            Type at least 2 characters to search.
          </div>
        ) : null}
        {nothing ? <CommandEmpty>No matching records found.</CommandEmpty> : null}

        {data?.customers.length ? (
          <CommandGroup heading="Customers">
            {data.customers.map((c) => (
              <CommandItem
                key={c.id}
                value={`customer-${c.id}-${customerName(c)}`}
                onSelect={() =>
                  go(() => navigate({ to: "/customers/$customerId", params: { customerId: c.id } }))
                }
              >
                <span className="font-medium">{customerName(c)}</span>
                <span className="ml-2 text-xs text-muted-foreground">{c.email}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {data?.properties.length ? (
          <CommandGroup heading="Properties">
            {data.properties.map((p) => (
              <CommandItem
                key={p.id}
                value={`property-${p.id}-${p.address}`}
                onSelect={() =>
                  go(() =>
                    navigate({ to: "/properties/$propertyId", params: { propertyId: p.id } }),
                  )
                }
              >
                <span className="font-medium">{p.property_name || p.address}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {p.address}
                  {p.city ? `, ${p.city}` : ""}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {data?.invoices.length ? (
          <CommandGroup heading="Invoices">
            {data.invoices.map((i) => (
              <CommandItem
                key={i.id}
                value={`invoice-${i.id}-${i.invoice_number}`}
                onSelect={() =>
                  go(() => navigate({ to: "/invoices/$invoiceId", params: { invoiceId: i.id } }))
                }
              >
                <span className="font-medium">{i.invoice_number}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {shortDate(i.invoice_date)} · {money(i.total)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {data?.plans.length ? (
          <CommandGroup heading="Service plans">
            {data.plans.map((p) => (
              <CommandItem
                key={p.id}
                value={`plan-${p.id}-${p.service_name}`}
                onSelect={() => go(() => navigate({ to: "/service-plans" }))}
              >
                <span className="font-medium">{p.service_name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
