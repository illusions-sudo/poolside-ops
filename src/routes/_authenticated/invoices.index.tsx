import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { AppShell } from "@/components/shell/app-shell";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/shell/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { customerName, friendlyError, money, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/invoices/")({
  head: () => ({
    meta: [
      { title: "Invoices — AquaLedger" },
      { name: "description", content: "All customer invoices with totals, balances and status." },
      { property: "og:title", content: "Invoices — AquaLedger" },
      { property: "og:description", content: "Invoice totals, balances and payment status." },
    ],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const invoices = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number, invoice_date, due_date, total, amount_paid, amount_due, status, customers(first_name, last_name, company_name)",
        )
        .order("invoice_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell>
      <PageHeader title="Invoices" description="Totals, balances and payment status." />

      <div className="panel overflow-hidden">
        {invoices.isLoading ? (
          <LoadingRows rows={6} cols={5} />
        ) : invoices.isError ? (
          <ErrorState
            message={friendlyError(invoices.error, "We couldn't load your invoices.")}
            onRetry={() => void invoices.refetch()}
          />
        ) : !invoices.data?.length ? (
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Invoices created for your customers will appear here with live balances."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Dates</th>
                  <th className="px-4 py-2.5 font-medium">Total</th>
                  <th className="px-4 py-2.5 font-medium">Balance</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.data.map((i) => (
                  <tr key={i.id} className="hover:bg-accent/25">
                    <td className="px-4 py-3">
                      <Link
                        to="/invoices/$invoiceId"
                        params={{ invoiceId: i.id }}
                        className="num font-medium hover:underline"
                      >
                        {i.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{customerName(i.customers)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <span className="block">Issued {shortDate(i.invoice_date)}</span>
                      <span className="block">Due {shortDate(i.due_date)}</span>
                    </td>
                    <td className="num px-4 py-3">{money(i.total)}</td>
                    <td className="num px-4 py-3">{money(i.amount_due)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={i.status} />
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
