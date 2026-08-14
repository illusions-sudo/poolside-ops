import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Gauge, Plus } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { ServicePlanDialog, type ServicePlanRow } from "@/components/plans/service-plan-dialog";
import { StatusBadge } from "@/components/shell/status-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  BILLING_LABELS,
  FREQUENCY_LABELS,
  customerName,
  friendlyError,
  money,
  shortDate,
} from "@/lib/format";

export const Route = createFileRoute("/_authenticated/service-plans")({
  head: () => ({
    meta: [
      { title: "Service Plans — AquaLedger" },
      {
        name: "description",
        content: "Recurring pool service plans with frequency, pricing and next visit dates.",
      },
      { property: "og:title", content: "Service Plans — AquaLedger" },
      { property: "og:description", content: "Recurring pool service plans and pricing." },
    ],
  }),
  component: ServicePlansPage,
});

function ServicePlansPage() {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServicePlanRow | null>(null);

  const plans = useQuery({
    queryKey: ["service-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_plans")
        .select("*, customers(first_name, last_name, company_name), properties(address, city)")
        .order("status")
        .order("next_service_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell>
      <PageHeader
        title="Service plans"
        description="Recurring work, how often it happens and what it bills."
        actions={
          isAdmin ? (
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" /> New plan
            </Button>
          ) : null
        }
      />

      <div className="panel overflow-hidden">
        {plans.isLoading ? (
          <LoadingRows rows={6} cols={5} />
        ) : plans.isError ? (
          <ErrorState
            message={friendlyError(plans.error, "We couldn't load your service plans.")}
            onRetry={() => void plans.refetch()}
          />
        ) : !plans.data?.length ? (
          <EmptyState
            icon={Gauge}
            title="No service plans yet"
            description="Create a plan for a property to schedule recurring visits and consistent billing."
            action={
              isAdmin ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setOpen(true);
                  }}
                >
                  <Plus className="mr-2 size-4" /> New plan
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Plan</th>
                  <th className="px-4 py-2.5 font-medium">Customer / property</th>
                  <th className="px-4 py-2.5 font-medium">Schedule</th>
                  <th className="px-4 py-2.5 font-medium">Price</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plans.data.map((p) => (
                  <tr key={p.id} className="hover:bg-accent/25">
                    <td className="px-4 py-3 font-medium">{p.service_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="block">{customerName(p.customers)}</span>
                      <span className="block text-xs">{p.properties?.address}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="block">
                        {FREQUENCY_LABELS[p.frequency] ?? p.frequency}
                      </span>
                      <span className="block text-xs">
                        Billed {BILLING_LABELS[p.billing_frequency] ?? p.billing_frequency} · next{" "}
                        {shortDate(p.next_service_date)}
                      </span>
                    </td>
                    <td className="num px-4 py-3">{money(p.price)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(p);
                            setOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ServicePlanDialog open={open} onOpenChange={setOpen} plan={editing} />
    </AppShell>
  );
}
