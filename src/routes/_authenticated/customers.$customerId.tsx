import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { PropertyDialog } from "@/components/properties/property-dialog";
import { ServicePlanDialog } from "@/components/plans/service-plan-dialog";
import { StatusBadge } from "@/components/shell/status-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FREQUENCY_LABELS, customerName, friendlyError, money, num, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  head: () => ({
    meta: [
      { title: "Customer details — AquaLedger" },
      {
        name: "description",
        content: "Customer contact details, properties, service plans, invoices and history.",
      },
      { property: "og:title", content: "Customer details — AquaLedger" },
      { property: "og:description", content: "Full customer record and service history." },
    ],
  }),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { customerId } = Route.useParams();
  const { isAdmin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  const q = useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      const [customer, properties, plans, invoices, services] = await Promise.all([
        supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
        supabase
          .from("properties")
          .select("id, property_name, address, city, state, active, pools(count)")
          .eq("customer_id", customerId)
          .order("address"),
        supabase
          .from("service_plans")
          .select("id, service_name, frequency, price, status, next_service_date")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("invoices")
          .select("id, invoice_number, invoice_date, total, amount_due, status")
          .eq("customer_id", customerId)
          .order("invoice_date", { ascending: false })
          .limit(10),
        supabase
          .from("service_records")
          .select("id, service_date, status, properties(address)")
          .eq("customer_id", customerId)
          .order("service_date", { ascending: false })
          .limit(10),
      ]);
      if (customer.error) throw customer.error;
      return {
        customer: customer.data,
        properties: properties.data ?? [],
        plans: plans.data ?? [],
        invoices: invoices.data ?? [],
        services: services.data ?? [],
      };
    },
  });

  const c = q.data?.customer;

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/customers">
          <ArrowLeft className="mr-2 size-4" /> All customers
        </Link>
      </Button>

      {q.isLoading ? (
        <div className="panel">
          <LoadingRows rows={5} cols={3} />
        </div>
      ) : q.isError ? (
        <ErrorState
          message={friendlyError(q.error, "We couldn't load this customer.")}
          onRetry={() => void q.refetch()}
        />
      ) : !c ? (
        <EmptyState
          icon={MapPin}
          title="Customer not found"
          description="This customer may have been removed."
          action={
            <Button asChild>
              <Link to="/customers">Back to customers</Link>
            </Button>
          }
        />
      ) : (
        <>
          <PageHeader
            title={customerName(c)}
            description={[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details yet"}
            actions={
              isAdmin ? (
                <>
                  <Button variant="outline" onClick={() => setEditOpen(true)}>
                    <Pencil className="mr-2 size-4" /> Edit
                  </Button>
                  <Button onClick={() => setPropertyOpen(true)}>
                    <Plus className="mr-2 size-4" /> Add property
                  </Button>
                </>
              ) : null
            }
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="panel p-4">
              <h2 className="font-display text-sm font-semibold">Billing</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Address" value={c.billing_address} />
                <Row
                  label="City / State"
                  value={[c.billing_city, c.billing_state, c.billing_zip]
                    .filter(Boolean)
                    .join(", ")}
                />
                <Row label="Email" value={c.email} />
                <Row label="Phone" value={c.phone} />
                <Row label="Alternate" value={c.alternate_phone} />
              </dl>
              {c.notes ? (
                <>
                  <h3 className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">
                    Internal notes
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.notes}</p>
                </>
              ) : null}
            </section>

            <section className="panel lg:col-span-2">
              <header className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="font-display text-sm font-semibold">Properties</h2>
                {isAdmin ? (
                  <Button variant="ghost" size="sm" onClick={() => setPropertyOpen(true)}>
                    <Plus className="mr-1.5 size-4" /> Add
                  </Button>
                ) : null}
              </header>
              {q.data?.properties.length ? (
                <ul className="divide-y divide-border">
                  {q.data.properties.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/properties/$propertyId"
                          params={{ propertyId: p.id }}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {p.property_name || p.address}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.address}
                          {p.city ? `, ${p.city}` : ""} {p.state ?? ""}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {p.pools?.[0]?.count ?? 0} pools
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={MapPin}
                  title="No properties yet"
                  description="Add the service address so you can track pools and schedule work."
                />
              )}
            </section>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="panel">
              <header className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="font-display text-sm font-semibold">Service plans</h2>
                {isAdmin && q.data?.properties.length ? (
                  <Button variant="ghost" size="sm" onClick={() => setPlanOpen(true)}>
                    <Plus className="mr-1.5 size-4" /> Add
                  </Button>
                ) : null}
              </header>
              {q.data?.plans.length ? (
                <ul className="divide-y divide-border">
                  {q.data.plans.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.service_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {FREQUENCY_LABELS[p.frequency] ?? p.frequency} · next{" "}
                          {shortDate(p.next_service_date)}
                        </p>
                      </div>
                      <span className="num text-sm">{money(p.price)}</span>
                      <StatusBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={Plus}
                  title="No service plans"
                  description="Create a recurring plan to schedule visits and bill consistently."
                />
              )}
            </section>

            <section className="panel">
              <header className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="font-display text-sm font-semibold">Recent invoices</h2>
                <Link to="/invoices" className="text-xs font-medium text-primary hover:underline">
                  All invoices
                </Link>
              </header>
              {q.data?.invoices.length ? (
                <ul className="divide-y divide-border">
                  {q.data.invoices.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/invoices/$invoiceId"
                          params={{ invoiceId: i.id }}
                          className="text-sm font-medium hover:underline"
                        >
                          {i.invoice_number}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {shortDate(i.invoice_date)} · {money(i.total)} total
                        </p>
                      </div>
                      <span className="num text-sm">{money(num(i.amount_due))}</span>
                      <StatusBadge status={i.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={Plus}
                  title="No invoices yet"
                  description="Invoices you create for this customer will appear here."
                />
              )}
            </section>
          </div>

          <section className="panel mt-6">
            <header className="border-b border-border px-4 py-3">
              <h2 className="font-display text-sm font-semibold">Service history</h2>
            </header>
            {q.data?.services.length ? (
              <ul className="divide-y divide-border">
                {q.data.services.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="num w-28 text-xs text-muted-foreground">
                      {shortDate(s.service_date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {s.properties?.address ?? "—"}
                    </span>
                    <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Plus}
                title="No visits logged"
                description="Visits appear here once scheduled or completed."
              />
            )}
          </section>

          <CustomerDialog open={editOpen} onOpenChange={setEditOpen} customer={c} />
          <PropertyDialog
            open={propertyOpen}
            onOpenChange={setPropertyOpen}
            customerId={customerId}
          />
          <ServicePlanDialog open={planOpen} onOpenChange={setPlanOpen} defaults={{ customerId }} />
        </>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-words">{value || "—"}</dd>
    </div>
  );
}
