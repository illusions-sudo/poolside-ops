import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Ban, Loader2, Pencil, Plus, Printer, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { InvoiceDialog } from "@/components/invoices/invoice-dialog";
import { PaymentDialog } from "@/components/invoices/payment-dialog";
import { AppShell } from "@/components/shell/app-shell";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/shell/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  PAYMENT_METHOD_LABELS,
  customerName,
  friendlyError,
  money,
  num,
  shortDate,
} from "@/lib/format";

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
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [item, setItem] = useState({ description: "", quantity: "1", unit_price: "" });
  const [addConfirmOpen, setAddConfirmOpen] = useState(false);


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

  const refresh = async () => {
    await queryClient.invalidateQueries();
  };

  const addItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("invoice_items").insert({
        invoice_id: invoiceId,
        description: item.description.trim(),
        quantity: num(item.quantity),
        unit_price: num(item.unit_price),
        position: (invoice.data?.invoice_items ?? []).length,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setAddConfirmOpen(false);
      setItem({ description: "", quantity: "1", unit_price: "" });

      toast.success("Line item added.");
      await refresh();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't add that line item.")),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoice_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setDeleteItemId(null);
      toast.success("Line item removed.");
      await refresh();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't remove that line item.")),
  });

  const removePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setDeletePaymentId(null);
      toast.success("Payment removed.");
      await refresh();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't remove that payment.")),
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("invoices").update({ status }).eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: async (_d, status) => {
      setVoidOpen(false);
      toast.success(status === "void" ? "Invoice voided." : "Invoice marked as sent.");
      await refresh();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't update this invoice.")),
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
  const isDraft = inv.status === "draft";
  const isVoid = inv.status === "void";
  // A fully paid invoice is locked; a partially paid one asks for confirmation.
  const isPaid = inv.status === "paid";
  const isPartiallyPaid = inv.status === "partially_paid";
  const canEditItems = isAdmin && !isVoid && !isPaid;
  const canPay = isAdmin && !isDraft && !isVoid && num(inv.amount_due) > 0;


  return (
    <AppShell>
      <PageHeader
        title={`Invoice ${inv.invoice_number}`}
        description={`${customerName(inv.customers)} · issued ${shortDate(inv.invoice_date)} · due ${shortDate(inv.due_date)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={inv.status} />
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-4" /> Print
            </Button>
            {isAdmin && !isVoid ? (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1.5 size-4" /> Edit
              </Button>
            ) : null}
            {isAdmin && isDraft ? (
              <Button size="sm" onClick={() => setStatus.mutate("sent")} disabled={setStatus.isPending}>
                {setStatus.isPending ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Send className="mr-1.5 size-4" />
                )}
                Mark as sent
              </Button>
            ) : null}
            {canPay ? <Button size="sm" onClick={() => setPayOpen(true)}>Record payment</Button> : null}
            {isAdmin && !isVoid ? (
              <Button variant="outline" size="sm" onClick={() => setVoidOpen(true)}>
                <Ban className="mr-1.5 size-4" /> Void
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Description</th>
                    <th className="px-4 py-2.5 font-medium">Qty</th>
                    <th className="px-4 py-2.5 font-medium">Rate</th>
                    <th className="px-4 py-2.5 font-medium">Amount</th>
                    {canEditItems ? <th className="px-4 py-2.5" /> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(inv.invoice_items ?? []).length === 0 ? (
                    <tr>
                      <td
                        colSpan={canEditItems ? 5 : 4}
                        className="px-4 py-6 text-center text-muted-foreground"
                      >
                        No line items yet.
                      </td>
                    </tr>
                  ) : (
                    (inv.invoice_items ?? []).map((it) => (
                      <tr key={it.id}>
                        <td className="px-4 py-3">{it.description}</td>
                        <td className="num px-4 py-3">{it.quantity}</td>
                        <td className="num px-4 py-3">{money(it.unit_price)}</td>
                        <td className="num px-4 py-3">{money(it.total)}</td>
                        {canEditItems ? (
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Remove line item"
                              onClick={() => setDeleteItemId(it.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {canEditItems ? (
            <form
              className="panel grid gap-3 p-4 sm:grid-cols-[1fr_5rem_7rem_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (!item.description.trim()) {
                  toast.error("Describe the line item.");
                  return;
                }
                if (num(item.quantity) <= 0) {
                  toast.error("Quantity must be greater than zero.");
                  return;
                }
                if (isPartiallyPaid) {
                  setAddConfirmOpen(true);
                  return;
                }
                addItem.mutate();

              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="item_description">Add line item</Label>
                <Input
                  id="item_description"
                  placeholder="e.g. Weekly service — May"
                  value={item.description}
                  onChange={(e) => setItem((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item_quantity">Qty</Label>
                <Input
                  id="item_quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => setItem((f) => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item_price">Rate</Label>
                <Input
                  id="item_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => setItem((f) => ({ ...f, unit_price: e.target.value }))}
                />
              </div>
              <Button type="submit" disabled={addItem.isPending}>
                {addItem.isPending ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 size-4" />
                )}
                Add
              </Button>
            </form>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="panel space-y-2 p-4 text-sm">
            <Row label="Subtotal" value={money(inv.subtotal)} />
            {num(inv.discount) > 0 ? <Row label="Discount" value={`−${money(inv.discount)}`} /> : null}
            <Row label={`Tax (${num(inv.tax_rate)}%)`} value={money(inv.tax)} />
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
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span>
                      {shortDate(p.payment_date)} ·{" "}
                      {PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="num text-foreground">{money(p.amount)}</span>
                      {isAdmin ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove payment"
                          onClick={() => setDeletePaymentId(p.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>

          {inv.notes ? (
            <div className="panel p-4 text-sm">
              <h3 className="text-sm font-semibold">Notes</h3>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{inv.notes}</p>
            </div>
          ) : null}
        </div>
      </div>

      <InvoiceDialog open={editOpen} onOpenChange={setEditOpen} invoice={inv} />
      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        invoiceId={inv.id}
        customerId={inv.customer_id}
        amountDue={num(inv.amount_due)}
      />
      <ConfirmDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title="Void this invoice?"
        description="Voiding keeps the invoice for your records but removes it from balances and reports. This cannot be undone."
        confirmLabel="Void invoice"
        destructive
        pending={setStatus.isPending}
        onConfirm={() => setStatus.mutate("void")}
      />
      <ConfirmDialog
        open={!!deleteItemId}
        onOpenChange={(o) => !o && setDeleteItemId(null)}
        title="Remove this line item?"
        description="The invoice total will be recalculated."
        confirmLabel="Remove"
        destructive
        pending={removeItem.isPending}
        onConfirm={() => deleteItemId && removeItem.mutate(deleteItemId)}
      />
      <ConfirmDialog
        open={!!deletePaymentId}
        onOpenChange={(o) => !o && setDeletePaymentId(null)}
        title="Remove this payment?"
        description="The invoice balance will be recalculated."
        confirmLabel="Remove"
        destructive
        pending={removePayment.isPending}
        onConfirm={() => deletePaymentId && removePayment.mutate(deletePaymentId)}
      />
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
