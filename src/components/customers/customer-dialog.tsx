import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { friendlyError } from "@/lib/format";

export type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

const EMPTY = {
  first_name: "",
  last_name: "",
  company_name: "",
  email: "",
  phone: "",
  alternate_phone: "",
  billing_address: "",
  billing_city: "",
  billing_state: "",
  billing_zip: "",
  notes: "",
};

export function CustomerDialog({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Pick<CustomerRow, keyof typeof EMPTY | "id"> | null;
}) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    if (!open) return;
    if (customer) {
      setForm({
        first_name: customer.first_name ?? "",
        last_name: customer.last_name ?? "",
        company_name: customer.company_name ?? "",
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        alternate_phone: customer.alternate_phone ?? "",
        billing_address: customer.billing_address ?? "",
        billing_city: customer.billing_city ?? "",
        billing_state: customer.billing_state ?? "",
        billing_zip: customer.billing_zip ?? "",
        notes: customer.notes ?? "",
      });
    } else {
      setForm({ ...EMPTY });
    }
  }, [open, customer]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        company_name: form.company_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        alternate_phone: form.alternate_phone.trim() || null,
        billing_address: form.billing_address.trim() || null,
        billing_city: form.billing_city.trim() || null,
        billing_state: form.billing_state.trim() || null,
        billing_zip: form.billing_zip.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (customer?.id) {
        const { error } = await supabase.from("customers").update(payload).eq("id", customer.id);
        if (error) throw error;
      } else {
        if (!organization?.id) throw new Error("Your company workspace is still loading.");
        const { error } = await supabase
          .from("customers")
          .insert({ ...payload, organization_id: organization.id });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(customer?.id ? "Customer updated." : "Customer added.");
      onOpenChange(false);
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't save that customer.")),
  });

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() && !form.last_name.trim() && !form.company_name.trim()) {
      toast.error("Enter at least a name or a company name.");
      return;
    }
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{customer?.id ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription>
            Contact and billing details used on invoices and property records.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" value={form.first_name} onChange={set("first_name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" value={form.last_name} onChange={set("last_name")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company_name">Company name</Label>
            <Input id="company_name" value={form.company_name} onChange={set("company_name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={set("email")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={set("phone")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="billing_address">Billing address</Label>
            <Input
              id="billing_address"
              value={form.billing_address}
              onChange={set("billing_address")}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="billing_city">City</Label>
              <Input id="billing_city" value={form.billing_city} onChange={set("billing_city")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing_state">State</Label>
              <Input id="billing_state" value={form.billing_state} onChange={set("billing_state")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing_zip">ZIP</Label>
              <Input id="billing_zip" value={form.billing_zip} onChange={set("billing_zip")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Internal notes</Label>
            <Textarea id="notes" rows={3} value={form.notes} onChange={set("notes")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {customer?.id ? "Save changes" : "Add customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
