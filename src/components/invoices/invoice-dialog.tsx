import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shell/confirm-dialog";
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
import { propertyLabel, useCustomerOptions, usePropertyOptions } from "@/hooks/useEntityOptions";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { addDays, customerName, friendlyError, today } from "@/lib/format";

export type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];

export function InvoiceDialog({
  open,
  onOpenChange,
  invoice,
  customerId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: InvoiceRow | null;
  customerId?: string;
  onCreated?: (id: string) => void;
}) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  // Lifecycle rules: paid and voided invoices keep their financial details
  // frozen (the database enforces this too); a partially paid invoice can still
  // be changed but only after an explicit confirmation.
  const status = invoice?.status ?? "draft";
  const financialsLocked = !!invoice && (status === "paid" || status === "void");
  const needsConfirm = !!invoice && status === "partially_paid";

  const [form, setForm] = useState({
    customer_id: customerId ?? "",
    property_id: "",
    invoice_date: today(),
    due_date: addDays(today(), 15),
    tax_rate: "0",
    discount: "0",
    notes: "",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const customers = useCustomerOptions(open && !customerId);
  const properties = usePropertyOptions(form.customer_id || undefined);

  useEffect(() => {
    if (!open) return;
    setConfirmOpen(false);
    if (invoice) {
      setForm({
        customer_id: invoice.customer_id,
        property_id: invoice.property_id ?? "",
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        tax_rate: String(invoice.tax_rate ?? 0),
        discount: String(invoice.discount ?? 0),
        notes: invoice.notes ?? "",
      });
      return;
    }
    const terms = organization?.default_payment_terms ?? 15;
    setForm({
      customer_id: customerId ?? "",
      property_id: "",
      invoice_date: today(),
      due_date: addDays(today(), terms),
      tax_rate: String(organization?.default_tax_rate ?? 0),
      discount: "0",
      notes: organization?.default_invoice_notes ?? "",
    });
  }, [open, invoice, customerId, organization]);

  // Does this edit touch anything that can move the balance?
  function financialChange() {
    if (!invoice) return false;
    return (
      form.customer_id !== invoice.customer_id ||
      (form.property_id || null) !== (invoice.property_id ?? null) ||
      Number(form.tax_rate || 0) !== Number(invoice.tax_rate ?? 0) ||
      Number(form.discount || 0) !== Number(invoice.discount ?? 0)
    );
  }

  const save = useMutation({
    mutationFn: async () => {
      // Only the invoice "header" is editable here. Subtotal, tax, total, amount
      // paid, amount due and status are always recalculated by the database.
      const payload = {
        customer_id: form.customer_id,
        property_id: form.property_id || null,
        invoice_date: form.invoice_date,
        due_date: form.due_date,
        tax_rate: Number(form.tax_rate) || 0,
        discount: Number(form.discount) || 0,
        notes: form.notes.trim() || null,
      };
      if (invoice?.id) {
        // A paid invoice keeps every financial field frozen; only notes change.
        const update = financialsLocked ? { notes: payload.notes } : payload;
        const { error } = await supabase.from("invoices").update(update).eq("id", invoice.id);
        if (error) throw error;
        return invoice.id;
      }
      if (!organization?.id) throw new Error("Your company workspace is still loading.");
      const { data, error } = await supabase
        .from("invoices")
        // invoice_number is assigned by the database when left blank.
        .insert({
          ...payload,
          organization_id: organization.id,
          status: "draft",
          invoice_number: "",
        })

        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: async (id) => {
      setConfirmOpen(false);
      toast.success(invoice?.id ? "Invoice updated." : "Draft invoice created.");
      onOpenChange(false);
      await queryClient.invalidateQueries();
      if (!invoice?.id) onCreated?.(id);
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't save that invoice.")),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "void") {
      toast.error("This invoice has been voided and can no longer be changed.");
      return;
    }
    if (!financialsLocked) {
      if (!form.customer_id) {
        toast.error("Choose the customer this invoice is for.");
        return;
      }
      if (form.due_date < form.invoice_date) {
        toast.error("The due date cannot be before the invoice date.");
        return;
      }
    }
    if (needsConfirm && financialChange()) {
      setConfirmOpen(true);
      return;
    }
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{invoice?.id ? "Edit invoice" : "New invoice"}</DialogTitle>
          <DialogDescription>
            {status === "void"
              ? "This invoice is voided and locked."
              : financialsLocked
                ? "This invoice is fully paid — only the notes can be changed."
                : needsConfirm
                  ? "A payment has already been received; financial changes need confirmation."
                  : "Totals are calculated from line items and payments by the database."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {!customerId ? (
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select
                value={form.customer_id}
                onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v, property_id: "" }))}
                disabled={financialsLocked}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {(customers.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {customerName(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Property (optional)</Label>
            <Select
              value={form.property_id}
              onValueChange={(v) => setForm((f) => ({ ...f, property_id: v }))}
              disabled={!form.customer_id || financialsLocked}
            >
              <SelectTrigger>
                <SelectValue placeholder="No specific property" />
              </SelectTrigger>
              <SelectContent>
                {(properties.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {propertyLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="invoice_date">Invoice date</Label>
              <Input
                id="invoice_date"
                type="date"
                value={form.invoice_date}
                onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))}
                disabled={financialsLocked}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due_date">Due date</Label>
              <Input
                id="due_date"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                disabled={financialsLocked}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tax_rate">Tax rate (%)</Label>
              <Input
                id="tax_rate"
                type="number"
                min="0"
                step="0.01"
                value={form.tax_rate}
                onChange={(e) => setForm((f) => ({ ...f, tax_rate: e.target.value }))}
                disabled={financialsLocked}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discount">Discount ($)</Label>
              <Input
                id="discount"
                type="number"
                min="0"
                step="0.01"
                value={form.discount}
                onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
                disabled={financialsLocked}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes shown on the invoice</Label>
            <Textarea
              id="notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              disabled={status === "void"}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || status === "void"}>
              {save.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {invoice?.id ? "Save changes" : "Create invoice"}
            </Button>
          </DialogFooter>
        </form>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="This invoice has already received a payment"
          description="Changing the customer, property, tax rate or discount will recalculate the total and the balance still owed. The change is recorded in the financial audit log."
          confirmLabel="Change anyway"
          destructive
          pending={save.isPending}
          onConfirm={() => save.mutate()}
        />
      </DialogContent>
    </Dialog>
  );
}
