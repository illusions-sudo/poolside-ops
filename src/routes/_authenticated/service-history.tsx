import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";

import { AppShell } from "@/components/shell/app-shell";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/shell/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { customerName, friendlyError, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/service-history")({
  head: () => ({
    meta: [
      { title: "Service History — AquaLedger" },
      { name: "description", content: "Every scheduled and completed pool service visit." },
      { property: "og:title", content: "Service History — AquaLedger" },
      { property: "og:description", content: "Scheduled and completed service visits." },
    ],
  }),
  component: ServiceHistoryPage,
});

function ServiceHistoryPage() {
  const records = useQuery({
    queryKey: ["service-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_records")
        .select(
          "id, service_date, status, notes, customers(first_name, last_name, company_name), properties(address, city)",
        )
        .order("service_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell>
      <PageHeader
        title="Service history"
        description="Scheduled and completed visits across every property."
      />

      <div className="panel overflow-hidden">
        {records.isLoading ? (
          <LoadingRows rows={6} cols={4} />
        ) : records.isError ? (
          <ErrorState
            message={friendlyError(records.error, "We couldn't load service history.")}
            onRetry={() => void records.refetch()}
          />
        ) : !records.data?.length ? (
          <EmptyState
            icon={CalendarClock}
            title="No service visits yet"
            description="Visits appear here as they're scheduled and completed."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Property</th>
                  <th className="px-4 py-2.5 font-medium">Notes</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.data.map((r) => (
                  <tr key={r.id} className="hover:bg-accent/25">
                    <td className="num px-4 py-3">{shortDate(r.service_date)}</td>
                    <td className="px-4 py-3">{customerName(r.customers)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.properties?.address}
                      {r.properties?.city ? `, ${r.properties.city}` : ""}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                      {r.notes || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
