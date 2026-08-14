import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shell/app-shell";
import { ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/shell/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { customerName, friendlyError, money, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/invoices/$invoiceId")({
  head: () => ({
    meta: [
      { title: "Invoice — AquaLedger" },
      { name: "description", content: "Invoice line items, totals and payment history." },
      { property: "og:title", content: "Invoice — AquaLedger" },
      { property: "og:description", content: "Invoice line items, totals and payments." },
    ],
  }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { invoiceId } = Route.useParams();

  const invoice = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "*, customers(first_name, last_name, company_name, email), invoice_items(*), payments(*)",
        )
        .eq("id", invoiceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (invoice.isLoading) {
    return (
      <AppShell>
        <div className="panel overflow-hidden">
          <LoadingRows rows={6} cols={3} />
        </div>
      </AppShell>
    );
  }

  if (invoice.isError || !invoice.data) {
    return (
      <AppShell>
        <div className="panel overflow-hidden">
          <ErrorState
            message={friendlyError(invoice.error, "We couldn't load this invoice.")}
            onRetry={() => void invoice.refetch()}
          />
        </div>
      </AppShell>
    );
  }

  const inv = invoice.data;

  return (
    <AppShell>
      <PageHeader
        title={`Invoice ${inv.invoice_number}`}
        description={`${customerName(inv.customers)} · issued ${shortDate(inv.invoice_date)} · due ${shortDate(inv.due_date)}`}
        actions={<StatusBadge status={inv.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel overflow-hidden lg:col-span-2">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium">Qty</th>
                <th className="px-4 py-2.5 font-medium">Rate</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(inv.invoice_items ?? []).map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="num px-4 py-3">{item.quantity}</td>
                  <td className="num px-4 py-3">{money(item.unit_price)}</td>
                  <td className="num px-4 py-3">{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <div className="panel space-y-2 p-4 text-sm">
            <Row label="Subtotal" value={money(inv.subtotal)} />
            <Row label="Tax" value={money(inv.tax_amount)} />
            <Row label="Total" value={money(inv.total)} bold />
            <Row label="Paid" value={money(inv.amount_paid)} />
            <Row label="Balance due" value={money(inv.amount_due)} bold />
          </div>

          <div className="panel p-4">
            <h3 className="text-sm font-semibold">Payments</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {(inv.payments ?? []).length === 0 ? (
                <li>No payments recorded.</li>
              ) : (
                inv.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <span>{shortDate(p.payment_date)}</span>
                    <span className="num text-foreground">{money(p.amount)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "num font-semibold" : "num"}>{value}</span>
    </div>
  );
}
