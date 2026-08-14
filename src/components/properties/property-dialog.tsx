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
import type { Database } from "@/integrations/supabase/types";
import { customerName, friendlyError } from "@/lib/format";

export type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];

const EMPTY = {
  customer_id: "",
  property_name: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  gate_code: "",
  access_notes: "",
  property_notes: "",
};

export function PropertyDialog({
  open,
  onOpenChange,
  property,
  customerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: PropertyRow | null;
  customerId?: string;
}) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });

  const customers = useQuery({
    queryKey: ["customer-options"],
    enabled: open && !customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, company_name")
        .eq("active", true)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!open) return;
    setForm(
      property
        ? {
            customer_id: property.customer_id,
            property_name: property.property_name ?? "",
            address: property.address,
            city: property.city ?? "",
            state: property.state ?? "",
            zip: property.zip ?? "",
            gate_code: property.gate_code ?? "",
            access_notes: property.access_notes ?? "",
            property_notes: property.property_notes ?? "",
          }
        : { ...EMPTY, customer_id: customerId ?? "" },
    );
  }, [open, property, customerId]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        customer_id: form.customer_id,
        property_name: form.property_name.trim() || null,
        address: form.address.trim(),
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        gate_code: form.gate_code.trim() || null,
        access_notes: form.access_notes.trim() || null,
        property_notes: form.property_notes.trim() || null,
      };
      if (property?.id) {
        const { error } = await supabase.from("properties").update(payload).eq("id", property.id);
        if (error) throw error;
      } else {
        if (!organization?.id) throw new Error("Your company workspace is still loading.");
        const { error } = await supabase
          .from("properties")
          .insert({ ...payload, organization_id: organization.id });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(property?.id ? "Property updated." : "Property added.");
      onOpenChange(false);
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't save that property.")),
  });

  const set =
    (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id) {
      toast.error("Choose which customer this property belongs to.");
      return;
    }
    if (!form.address.trim()) {
      toast.error("Enter the street address.");
      return;
    }
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{property?.id ? "Edit property" : "New property"}</DialogTitle>
          <DialogDescription>
            Service location details, including access instructions for technicians.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {!customerId ? (
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select
                value={form.customer_id}
                onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}
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
            <Label htmlFor="property_name">Property label</Label>
            <Input
              id="property_name"
              placeholder="e.g. Main residence"
              value={form.property_name}
              onChange={set("property_name")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Street address</Label>
            <Input id="address" value={form.address} onChange={set("address")} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={set("city")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" value={form.state} onChange={set("state")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zip">ZIP</Label>
              <Input id="zip" value={form.zip} onChange={set("zip")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gate_code">Gate code</Label>
            <Input id="gate_code" value={form.gate_code} onChange={set("gate_code")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="access_notes">Access notes</Label>
            <Textarea
              id="access_notes"
              rows={2}
              placeholder="Dog in yard, side gate, etc."
              value={form.access_notes}
              onChange={set("access_notes")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="property_notes">Property notes</Label>
            <Textarea
              id="property_notes"
              rows={2}
              value={form.property_notes}
              onChange={set("property_notes")}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {property?.id ? "Save changes" : "Add property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
