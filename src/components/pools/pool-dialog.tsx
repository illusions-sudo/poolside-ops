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
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { friendlyError } from "@/lib/format";

export type PoolRow = Database["public"]["Tables"]["pools"]["Row"];

const POOL_TYPES = ["chlorine", "salt_water", "mineral", "bromine", "spa", "other"];
const SURFACES = ["plaster", "pebble", "tile", "vinyl", "fiberglass", "other"];

const label = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

const EMPTY = {
  pool_name: "",
  pool_type: "chlorine",
  surface_type: "plaster",
  approximate_volume: "",
  equipment_notes: "",
  special_instructions: "",
};

export function PoolDialog({
  open,
  onOpenChange,
  propertyId,
  pool,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  pool?: PoolRow | null;
}) {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    if (!open) return;
    setForm(
      pool
        ? {
            pool_name: pool.pool_name ?? "",
            pool_type: pool.pool_type ?? "chlorine",
            surface_type: pool.surface_type ?? "plaster",
            approximate_volume: pool.approximate_volume ? String(pool.approximate_volume) : "",
            equipment_notes: pool.equipment_notes ?? "",
            special_instructions: pool.special_instructions ?? "",
          }
        : { ...EMPTY },
    );
  }, [open, pool]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        property_id: propertyId,
        pool_name: form.pool_name.trim() || null,
        pool_type: form.pool_type,
        surface_type: form.surface_type,
        approximate_volume: form.approximate_volume ? Number(form.approximate_volume) : null,
        equipment_notes: form.equipment_notes.trim() || null,
        special_instructions: form.special_instructions.trim() || null,
      };
      if (pool?.id) {
        const { error } = await supabase.from("pools").update(payload).eq("id", pool.id);
        if (error) throw error;
      } else {
        if (!organization?.id) throw new Error("Your company workspace is still loading.");
        const { error } = await supabase
          .from("pools")
          .insert({ ...payload, organization_id: organization.id });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(pool?.id ? "Pool updated." : "Pool added.");
      onOpenChange(false);
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't save that pool.")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pool?.id ? "Edit pool" : "Add pool"}</DialogTitle>
          <DialogDescription>
            Water body details used when scheduling and servicing this property.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="pool_name">Pool label</Label>
            <Input
              id="pool_name"
              placeholder="e.g. Backyard pool"
              value={form.pool_name}
              onChange={(e) => setForm((f) => ({ ...f, pool_name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Water type</Label>
              <Select
                value={form.pool_type}
                onValueChange={(v) => setForm((f) => ({ ...f, pool_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POOL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {label(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Surface</Label>
              <Select
                value={form.surface_type}
                onValueChange={(v) => setForm((f) => ({ ...f, surface_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SURFACES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {label(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="volume">Approximate volume (gallons)</Label>
            <Input
              id="volume"
              type="number"
              min={0}
              step={100}
              value={form.approximate_volume}
              onChange={(e) => setForm((f) => ({ ...f, approximate_volume: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="equipment_notes">Equipment notes</Label>
            <Textarea
              id="equipment_notes"
              rows={2}
              placeholder="Pump, filter, heater, automation…"
              value={form.equipment_notes}
              onChange={(e) => setForm((f) => ({ ...f, equipment_notes: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="special_instructions">Special instructions</Label>
            <Textarea
              id="special_instructions"
              rows={2}
              value={form.special_instructions}
              onChange={(e) => setForm((f) => ({ ...f, special_instructions: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {pool?.id ? "Save changes" : "Add pool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
