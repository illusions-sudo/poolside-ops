import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  PAYMENT_METHOD_LABELS,
  customerName,
  friendlyError,
  money,
  num,
  today,
} from "@/lib/format";

/**
 * Records a payment against an invoice. The database validates the amount
 * (no overpayment, no payments on draft/void invoices) and recalculates the
 * invoice balance, so this dialog only collects input and surfaces errors.
 */
export function PaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  customerId,
  amountDue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId?: string;
  customerId?: string;
  amountDue?: number;
}) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    invoice_id: invoiceId ?? "",
    payment_date: today(),
    amount: "",
    payment_method: "check",
    transaction_reference: "",
    notes: "",
  });

  // Invoices that can still accept a payment (never draft or void).
  const openInvoices = useQuery({
    queryKey: ["payable-invoices"],
    enabled: open && !invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number, customer_id, amount_due, total, customers(first_name, last_name, company_name)",
        )
        .in("status", ["sent", "partially_paid", "overdue"])
        .gt("amount_due", 0)
        .order("due_date", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      invoice_id: invoiceId ?? "",
      payment_date: today(),
      amount: amountDue && amountDue > 0 ? amountDue.toFixed(2) : "",
      payment_method: "check",
      transaction_reference: "",
      notes: "",
    });
  }, [open, invoiceId, amountDue]);

  const selected = (openInvoices.data ?? []).find((i) => i.id === form.invoice_id);

  const save = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error("Your company workspace is still loading.");
      const custId = customerId ?? selected?.customer_id;
      if (!custId) throw new Error("Choose the invoice this payment applies to.");
      const { error } = await supabase.from("payments").insert({
        organization_id: organization.id,
        customer_id: custId,
        invoice_id: form.invoice_id,
        payment_date: form.payment_date,
        amount: Number(form.amount),
        payment_method: form.payment_method,
        transaction_reference: form.transaction_reference.trim() || null,
        notes: form.notes.trim() || null,
        status: "completed",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Payment recorded.");
      onOpenChange(false);
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't record that payment.")),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.invoice_id) {
      toast.error("Choose the invoice this payment applies to.");
      return;
    }
    const amount = num(form.amount);
    if (!(amount > 0)) {
      toast.error("Enter a payment amount greater than zero.");
      return;
    }
    const max = invoiceId ? amountDue : selected ? num(selected.amount_due) : undefined;
    if (max !== undefined && amount > max + 0.005) {
      toast.error(`That is more than the ${money(max)} still owed on this invoice.`);
      return;
    }
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {invoiceId && amountDue !== undefined
              ? `${money(amountDue)} still owed on this invoice.`
              : "Apply a payment to an open invoice."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {!invoiceId ? (
            <div className="space-y-1.5">
              <Label>Invoice</Label>
              <Select
                value={form.invoice_id}
                onValueChange={(v) => {
                  const inv = (openInvoices.data ?? []).find((i) => i.id === v);
                  setForm((f) => ({
                    ...f,
                    invoice_id: v,
                    amount: inv ? num(inv.amount_due).toFixed(2) : f.amount,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an open invoice" />
                </SelectTrigger>
                <SelectContent>
                  {(openInvoices.data ?? []).map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.invoice_number} · {customerName(i.customers)} · {money(i.amount_due)} due
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {openInvoices.data && !openInvoices.data.length ? (
                <p className="text-xs text-muted-foreground">
                  No invoices are currently awaiting payment.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment_date">Date</Label>
              <Input
                id="payment_date"
                type="date"
                value={form.payment_date}
                onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select
              value={form.payment_method}
              onValueChange={(v) => setForm((f) => ({ ...f, payment_method: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transaction_reference">Reference (optional)</Label>
            <Input
              id="transaction_reference"
              placeholder="Check number, transaction ID…"
              value={form.transaction_reference}
              onChange={(e) => setForm((f) => ({ ...f, transaction_reference: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment_notes">Notes (optional)</Label>
            <Textarea
              id="payment_notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
