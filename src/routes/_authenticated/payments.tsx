import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";

import { AppShell } from "@/components/shell/app-shell";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { supabase } from "@/integrations/supabase/client";
import { customerName, friendlyError, money, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payments — AquaLedger" },
      { name: "description", content: "Recorded customer payments across all invoices." },
      { property: "og:title", content: "Payments — AquaLedger" },
      { property: "og:description", content: "Recorded customer payments and methods." },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const payments = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "id, payment_date, amount, payment_method, transaction_reference, invoices(invoice_number), customers(first_name, last_name, company_name)",
        )
        .order("payment_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell>
      <PageHeader title="Payments" description="Every payment recorded against an invoice." />

      <div className="panel overflow-hidden">
        {payments.isLoading ? (
          <LoadingRows rows={6} cols={4} />
        ) : payments.isError ? (
          <ErrorState
            message={friendlyError(payments.error, "We couldn't load payments.")}
            onRetry={() => void payments.refetch()}
          />
        ) : !payments.data?.length ? (
          <EmptyState
            icon={CreditCard}
            title="No payments recorded"
            description="Payments applied to invoices will show up here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Method</th>
                  <th className="px-4 py-2.5 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.data.map((p) => (
                  <tr key={p.id} className="hover:bg-accent/25">
                    <td className="num px-4 py-3">{shortDate(p.payment_date)}</td>
                    <td className="px-4 py-3">{customerName(p.customers)}</td>
                    <td className="num px-4 py-3 text-muted-foreground">
                      {p.invoices?.invoice_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.payment_method}
                      {p.transaction_reference ? ` · ${p.transaction_reference}` : ""}
                    </td>
                    <td className="num px-4 py-3">{money(p.amount)}</td>
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
