import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import type { TeamMember } from "@/hooks/useTechnicians";
import { supabase } from "@/integrations/supabase/client";
import { createTechnician } from "@/lib/technicians.functions";
import { friendlyError } from "@/lib/format";

const EMPTY = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  password: "",
  role: "employee" as "employee" | "admin",
};

export function TechnicianDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: TeamMember | null;
}) {
  const queryClient = useQueryClient();
  const create = useServerFn(createTechnician);
  const [form, setForm] = useState(EMPTY);
  const editing = !!member?.id;

  useEffect(() => {
    if (!open) return;
    setForm({
      first_name: member?.first_name ?? "",
      last_name: member?.last_name ?? "",
      email: member?.email ?? "",
      phone: member?.phone ?? "",
      password: "",
      role: member?.role === "employee" || !member?.role ? "employee" : "admin",
    });
  }, [open, member]);

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from("profiles")
          .update({
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            phone: form.phone.trim() || null,
          })
          .eq("id", member!.id);
        if (error) throw error;
        return;
      }
      await create({
        data: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || null,
          password: form.password,
          role: form.role,
        },
      });
    },
    onSuccess: async () => {
      toast.success(editing ? "Team member updated." : "Team member added.");
      onOpenChange(false);
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't save that team member.")),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("Enter a first and last name.");
      return;
    }
    if (!editing) {
      if (!form.email.trim()) {
        toast.error("Enter a work email for their login.");
        return;
      }
      if (form.password.length < 8) {
        toast.error("Choose a temporary password of at least 8 characters.");
        return;
      }
    }
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit team member" : "Add team member"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the contact details for this technician."
              : "Create a login so this technician can see their day and complete visits."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tech_first">First name</Label>
              <Input
                id="tech_first"
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tech_last">Last name</Label>
              <Input
                id="tech_last"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tech_email">Work email</Label>
            <Input
              id="tech_email"
              type="email"
              value={form.email}
              disabled={editing}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tech_phone">Mobile phone</Label>
            <Input
              id="tech_phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>

          {editing ? null : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tech_password">Temporary password</Label>
                <Input
                  id="tech_password"
                  type="text"
                  autoComplete="off"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Access level</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v as "employee" | "admin" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Technician</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
