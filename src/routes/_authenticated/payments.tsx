import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/shell/app-shell";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { PaymentDialog } from "@/components/invoices/payment-dialog";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENT_METHOD_LABELS, customerName, friendlyError, money, shortDate } from "@/lib/format";

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
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [recordOpen, setRecordOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setDeleteId(null);
      toast.success("Payment removed.");
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't remove that payment.")),
  });

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
      <PageHeader
        title="Payments"
        description="Every payment recorded against an invoice."
        actions={
          isAdmin ? (
            <Button onClick={() => setRecordOpen(true)}>
              <Plus className="mr-1.5 size-4" /> Record payment
            </Button>
          ) : null
        }
      />

      <PaymentDialog open={recordOpen} onOpenChange={setRecordOpen} />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Remove this payment?"
        description="The related invoice balance will be recalculated."
        confirmLabel="Remove"
        destructive
        pending={remove.isPending}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
      />

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
                  {isAdmin ? <th className="px-4 py-2.5" /> : null}
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
                      {PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}
                      {p.transaction_reference ? ` · ${p.transaction_reference}` : ""}
                    </td>
                    <td className="num px-4 py-3">{money(p.amount)}</td>
                    {isAdmin ? (
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove payment"
                          onClick={() => setDeleteId(p.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    ) : null}
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
