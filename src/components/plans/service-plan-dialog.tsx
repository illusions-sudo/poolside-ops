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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  poolLabel,
  propertyLabel,
  useCustomerOptions,
  usePoolOptions,
  usePropertyOptions,
} from "@/hooks/useEntityOptions";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  BILLING_LABELS,
  FREQUENCY_LABELS,
  PLAN_STATUS_LABELS,
  customerName,
  friendlyError,
  today,
} from "@/lib/format";

export type ServicePlanRow = Database["public"]["Tables"]["service_plans"]["Row"];

export function ServicePlanDialog({
  open,
  onOpenChange,
  plan,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: ServicePlanRow | null;
  defaults?: { customerId?: string; propertyId?: string; poolId?: string };
}) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    customer_id: "",
    property_id: "",
    pool_id: "",
    service_name: "Weekly pool maintenance",
    description: "",
    frequency: "weekly",
    billing_frequency: "monthly",
    price: "",
    status: "active",
    next_service_date: today(),
  });

  const customers = useCustomerOptions(open);
  const properties = usePropertyOptions(form.customer_id || undefined);
  const pools = usePoolOptions(form.property_id || undefined);

  useEffect(() => {
    if (!open) return;
    setForm({
      customer_id: plan?.customer_id ?? defaults?.customerId ?? "",
      property_id: plan?.property_id ?? defaults?.propertyId ?? "",
      pool_id: plan?.pool_id ?? defaults?.poolId ?? "",
      service_name: plan?.service_name ?? "Weekly pool maintenance",
      description: plan?.description ?? "",
      frequency: plan?.frequency ?? "weekly",
      billing_frequency: plan?.billing_frequency ?? "monthly",
      price: plan ? String(plan.price) : "",
      status: plan?.status ?? "active",
      next_service_date: plan?.next_service_date ?? today(),
    });
  }, [open, plan, defaults]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        customer_id: form.customer_id,
        property_id: form.property_id,
        pool_id: form.pool_id || null,
        service_name: form.service_name.trim(),
        description: form.description.trim() || null,
        frequency: form.frequency,
        billing_frequency: form.billing_frequency,
        price: Number(form.price || 0),
        status: form.status,
        next_service_date: form.next_service_date || null,
      };
      if (plan?.id) {
        const { error } = await supabase.from("service_plans").update(payload).eq("id", plan.id);
        if (error) throw error;
      } else {
        if (!organization?.id) throw new Error("Your company workspace is still loading.");
        const { error } = await supabase
          .from("service_plans")
          .insert({ ...payload, organization_id: organization.id });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(plan?.id ? "Service plan updated." : "Service plan created.");
      onOpenChange(false);
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't save that service plan.")),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id || !form.property_id) {
      toast.error("Choose the customer and property this plan covers.");
      return;
    }
    if (!form.service_name.trim()) {
      toast.error("Give the plan a name.");
      return;
    }
    if (Number(form.price) <= 0) {
      toast.error("Enter the price billed for this plan.");
      return;
    }
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{plan?.id ? "Edit service plan" : "New service plan"}</DialogTitle>
          <DialogDescription>
            Recurring work for one property, with the price used on invoices.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select
              value={form.customer_id}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, customer_id: v, property_id: "", pool_id: "" }))
              }
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Property</Label>
              <Select
                value={form.property_id}
                disabled={!form.customer_id}
                onValueChange={(v) => setForm((f) => ({ ...f, property_id: v, pool_id: "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a property" />
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
            <div className="space-y-1.5">
              <Label>Pool (optional)</Label>
              <Select
                value={form.pool_id}
                disabled={!form.property_id}
                onValueChange={(v) => setForm((f) => ({ ...f, pool_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All pools" />
                </SelectTrigger>
                <SelectContent>
                  {(pools.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {poolLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="service_name">Plan name</Label>
            <Input
              id="service_name"
              value={form.service_name}
              onChange={(e) => setForm((f) => ({ ...f, service_name: e.target.value }))}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Service frequency</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Billing frequency</Label>
              <Select
                value={form.billing_frequency}
                onValueChange={(v) => setForm((f) => ({ ...f, billing_frequency: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BILLING_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next_service_date">Next service</Label>
              <Input
                id="next_service_date"
                type="date"
                value={form.next_service_date}
                onChange={(e) => setForm((f) => ({ ...f, next_service_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLAN_STATUS_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="What's included in each visit"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {plan?.id ? "Save changes" : "Create plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
