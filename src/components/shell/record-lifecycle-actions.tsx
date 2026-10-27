import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/format";

export function RecordLifecycleActions({
  kind,
  id,
  active,
  name,
  onDeleted,
}: {
  kind: "customer" | "property";
  id: string;
  active: boolean;
  name: string;
  onDeleted?: () => void;
}) {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from(kind === "customer" ? "customers" : "properties")
        .update({ active: !active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(
        `${kind === "customer" ? "Customer" : "Property"} ${active ? "deactivated" : "reactivated"}.`,
      );
      await queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(friendlyError(error, "We couldn't update this record.")),
  });
  const remove = useMutation({
    mutationFn: async () => {
      if (active) throw new Error(`Deactivate this ${kind} before deleting it.`);
      const result =
        kind === "customer"
          ? await supabase.rpc("delete_customer", { p_customer_id: id })
          : await supabase.rpc("delete_property", { p_property_id: id });
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      setDeleteOpen(false);
      queryClient.removeQueries({ queryKey: [kind, id] });
      toast.success(`${kind === "customer" ? "Customer" : "Property"} permanently deleted.`);
      onDeleted?.();
      await queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(friendlyError(error, "We couldn't delete this record.")),
  });
  if (!isAdmin) return null;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={update.isPending || remove.isPending}
        onClick={() => update.mutate()}
      >
        {active ? "Deactivate" : "Reactivate"}
      </Button>
      {!active ? (
        <Button
          variant="destructive"
          size="sm"
          disabled={update.isPending || remove.isPending}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-2 size-4" />
          Delete {kind}
        </Button>
      ) : null}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        destructive
        title={`Permanently delete ${name}?`}
        confirmLabel={`Delete ${kind}`}
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        description={
          kind === "customer"
            ? "This permanently removes the customer, all their properties, pools, service plans, visits, and notes. This cannot be undone. Customers with invoices or payments must be kept inactive instead."
            : "This permanently removes the property, its pools, service plans, visits, and property notes. This cannot be undone. Properties linked to invoices must be kept inactive instead."
        }
      />
    </>
  );
}
