import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { PropertyDialog } from "@/components/properties/property-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { customerName, friendlyError } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/properties/")({
  head: () => ({
    meta: [
      { title: "Properties — AquaLedger" },
      {
        name: "description",
        content: "Every service address with access notes, gate codes and pool counts.",
      },
      { property: "og:title", content: "Properties — AquaLedger" },
      { property: "og:description", content: "Service addresses and pool locations." },
    ],
  }),
  component: PropertiesPage,
});

function PropertiesPage() {
  const { isAdmin } = useAuth();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);

  const properties = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select(
          "id, property_name, address, city, state, zip, gate_code, active, customers(first_name, last_name, company_name), pools(count)",
        )
        .order("address");
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(() => {
    const list = properties.data ?? [];
    const t = term.trim().toLowerCase();
    if (!t) return list;
    return list.filter((p) =>
      [p.property_name, p.address, p.city, p.zip, customerName(p.customers)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t)),
    );
  }, [properties.data, term]);

  return (
    <AppShell>
      <PageHeader
        title="Properties"
        description="Service addresses, access details and the pools at each one."
        actions={
          isAdmin ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 size-4" /> New property
            </Button>
          ) : null
        }
      />

      <div className="relative mb-4 sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search address, city or customer"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      <div className="panel overflow-hidden">
        {properties.isLoading ? (
          <LoadingRows rows={6} cols={4} />
        ) : properties.isError ? (
          <ErrorState
            message={friendlyError(properties.error, "We couldn't load your properties.")}
            onRetry={() => void properties.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title={term ? "No matching properties" : "No properties yet"}
            description={
              term
                ? "Try a different address, city or customer name."
                : "Add a property to a customer to start tracking pools and visits."
            }
            action={
              isAdmin && !term ? (
                <Button onClick={() => setOpen(true)}>
                  <Plus className="mr-2 size-4" /> New property
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Property</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Gate code</th>
                  <th className="px-4 py-2.5 font-medium">Pools</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-accent/25">
                    <td className="px-4 py-3">
                      <Link
                        to="/properties/$propertyId"
                        params={{ propertyId: p.id }}
                        className="font-medium hover:underline"
                      >
                        {p.property_name || p.address}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {p.address}
                        {p.city ? `, ${p.city}` : ""} {p.state ?? ""} {p.zip ?? ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{customerName(p.customers)}</td>
                    <td className="num px-4 py-3 text-muted-foreground">{p.gate_code || "—"}</td>
                    <td className="num px-4 py-3 text-muted-foreground">
                      {p.pools?.[0]?.count ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PropertyDialog open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}
