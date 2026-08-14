import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Plus, Waves } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { PoolDialog } from "@/components/pools/pool-dialog";
import { PropertyDialog } from "@/components/properties/property-dialog";
import { StatusBadge } from "@/components/shell/status-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FREQUENCY_LABELS, customerName, friendlyError, money, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/properties/$propertyId")({
  head: () => ({
    meta: [
      { title: "Property details — AquaLedger" },
      { name: "description", content: "Pools, access notes, service plans and visit history." },
      { property: "og:title", content: "Property details — AquaLedger" },
      { property: "og:description", content: "Pool and service details for this address." },
    ],
  }),
  component: PropertyDetail,
});

function PropertyDetail() {
  const { propertyId } = Route.useParams();
  const { isAdmin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [poolOpen, setPoolOpen] = useState(false);

  const q = useQuery({
    queryKey: ["property", propertyId],
    queryFn: async () => {
      const [property, pools, plans, services] = await Promise.all([
        supabase
          .from("properties")
          .select("*, customers(id, first_name, last_name, company_name)")
          .eq("id", propertyId)
          .maybeSingle(),
        supabase.from("pools").select("*").eq("property_id", propertyId).order("created_at"),
        supabase
          .from("service_plans")
          .select("id, service_name, frequency, price, status, next_service_date")
          .eq("property_id", propertyId),
        supabase
          .from("service_records")
          .select("id, service_date, status, notes")
          .eq("property_id", propertyId)
          .order("service_date", { ascending: false })
          .limit(10),
      ]);
      if (property.error) throw property.error;
      return {
        property: property.data,
        pools: pools.data ?? [],
        plans: plans.data ?? [],
        services: services.data ?? [],
      };
    },
  });

  const p = q.data?.property;

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/properties">
          <ArrowLeft className="mr-2 size-4" /> All properties
        </Link>
      </Button>

      {q.isLoading ? (
        <div className="panel">
          <LoadingRows rows={5} cols={3} />
        </div>
      ) : q.isError ? (
        <ErrorState
          message={friendlyError(q.error, "We couldn't load this property.")}
          onRetry={() => void q.refetch()}
        />
      ) : !p ? (
        <EmptyState icon={Waves} title="Property not found" />
      ) : (
        <>
          <PageHeader
            title={p.property_name || p.address}
            description={`${p.address}${p.city ? `, ${p.city}` : ""} ${p.state ?? ""} ${p.zip ?? ""}`}
            actions={
              isAdmin ? (
                <>
                  <Button variant="outline" onClick={() => setEditOpen(true)}>
                    <Pencil className="mr-2 size-4" /> Edit
                  </Button>
                  <Button onClick={() => setPoolOpen(true)}>
                    <Plus className="mr-2 size-4" /> Add pool
                  </Button>
                </>
              ) : null
            }
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="panel p-4">
              <h2 className="font-display text-sm font-semibold">Details</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex gap-3">
                  <dt className="w-24 text-xs uppercase tracking-wide text-muted-foreground">
                    Customer
                  </dt>
                  <dd className="flex-1">
                    {p.customers ? (
                      <Link
                        to="/customers/$customerId"
                        params={{ customerId: p.customers.id }}
                        className="hover:underline"
                      >
                        {customerName(p.customers)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-24 text-xs uppercase tracking-wide text-muted-foreground">
                    Gate code
                  </dt>
                  <dd className="num flex-1">{p.gate_code || "—"}</dd>
                </div>
              </dl>
              {p.access_notes ? (
                <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted/60 p-3 text-sm">
                  {p.access_notes}
                </p>
              ) : null}
              {p.property_notes ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                  {p.property_notes}
                </p>
              ) : null}
            </section>

            <section className="panel lg:col-span-2">
              <header className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="font-display text-sm font-semibold">Pools</h2>
                {isAdmin ? (
                  <Button variant="ghost" size="sm" onClick={() => setPoolOpen(true)}>
                    <Plus className="mr-1.5 size-4" /> Add
                  </Button>
                ) : null}
              </header>
              {q.data?.pools.length ? (
                <ul className="divide-y divide-border">
                  {q.data.pools.map((pool) => (
                    <li key={pool.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <p className="flex-1 text-sm font-medium">{pool.pool_name || "Pool"}</p>
                        <span className="text-xs text-muted-foreground">
                          {pool.pool_type ?? "—"} · {pool.surface_type ?? "—"}
                        </span>
                        <span className="num text-xs text-muted-foreground">
                          {pool.approximate_volume ? `${pool.approximate_volume} gal` : ""}
                        </span>
                      </div>
                      {pool.special_instructions ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {pool.special_instructions}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={Waves}
                  title="No pools recorded"
                  description="Add the pool details so technicians know what they're servicing."
                />
              )}
            </section>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="panel">
              <header className="border-b border-border px-4 py-3">
                <h2 className="font-display text-sm font-semibold">Service plans</h2>
              </header>
              {q.data?.plans.length ? (
                <ul className="divide-y divide-border">
                  {q.data.plans.map((plan) => (
                    <li key={plan.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{plan.service_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {FREQUENCY_LABELS[plan.frequency] ?? plan.frequency} · next{" "}
                          {shortDate(plan.next_service_date)}
                        </p>
                      </div>
                      <span className="num text-sm">{money(plan.price)}</span>
                      <StatusBadge status={plan.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={Plus} title="No plans for this property" />
              )}
            </section>

            <section className="panel">
              <header className="border-b border-border px-4 py-3">
                <h2 className="font-display text-sm font-semibold">Recent visits</h2>
              </header>
              {q.data?.services.length ? (
                <ul className="divide-y divide-border">
                  {q.data.services.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="num w-28 text-xs text-muted-foreground">
                        {shortDate(s.service_date)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                        {s.notes || "—"}
                      </span>
                      <StatusBadge status={s.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={Plus} title="No visits logged yet" />
              )}
            </section>
          </div>

          <PropertyDialog open={editOpen} onOpenChange={setEditOpen} property={p} />
          <PoolDialog open={poolOpen} onOpenChange={setPoolOpen} propertyId={propertyId} />
        </>
      )}
    </AppShell>
  );
}
