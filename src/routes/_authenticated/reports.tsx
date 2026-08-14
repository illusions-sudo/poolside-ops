import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shell/app-shell";
import { ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError, money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — AquaLedger" },
      { name: "description", content: "Revenue, receivables and service volume for your company." },
      { property: "og:title", content: "Reports — AquaLedger" },
      { property: "og:description", content: "Revenue, receivables and service volume." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const report = useQuery({
    queryKey: ["reports-summary"],
    queryFn: async () => {
      const [invoices, payments, records] = await Promise.all([
        // Draft and voided invoices are never counted as revenue or as owed money.
        supabase
          .from("invoices")
          .select("total, amount_due, status")
          .not("status", "in", "(draft,void)"),
        supabase.from("payments").select("amount, payment_date").eq("status", "completed"),
        supabase.from("service_records").select("id, status"),
      ]);
      if (invoices.error) throw invoices.error;
      if (payments.error) throw payments.error;
      if (records.error) throw records.error;

      const invoiced = (invoices.data ?? []).reduce((s, i) => s + Number(i.total), 0);
      const outstanding = (invoices.data ?? []).reduce((s, i) => s + Number(i.amount_due), 0);
      const collected = (payments.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
      const completed = (records.data ?? []).filter((r) => r.status === "completed").length;

      return { invoiced, outstanding, collected, completed, visits: records.data?.length ?? 0 };
    },
  });

  return (
    <AppShell>
      <PageHeader title="Reports" description="How the business is performing right now." />

      {report.isLoading ? (
        <div className="panel overflow-hidden">
          <LoadingRows rows={4} cols={3} />
        </div>
      ) : report.isError || !report.data ? (
        <div className="panel overflow-hidden">
          <ErrorState
            message={friendlyError(report.error, "We couldn't build your reports.")}
            onRetry={() => void report.refetch()}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total invoiced" value={money(report.data.invoiced)} />
          <Stat label="Collected" value={money(report.data.collected)} />
          <Stat label="Outstanding" value={money(report.data.outstanding)} />
          <Stat
            label="Visits completed"
            value={`${report.data.completed} of ${report.data.visits}`}
          />
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="num mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
