import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, UserCog, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/shell/app-shell";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/shell/status-badge";
import { TechnicianDialog } from "@/components/technicians/technician-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useTeam, useTodayWorkload, type TeamMember } from "@/hooks/useTechnicians";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, friendlyError, initials, personName } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/technicians/")({
  head: () => ({
    meta: [
      { title: "Technicians — AquaLedger" },
      {
        name: "description",
        content: "Manage pool service technicians, access levels and today's field workload.",
      },
      { property: "og:title", content: "Technicians — AquaLedger" },
      { property: "og:description", content: "Your field team and today's workload." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TechniciansPage,
});

function TechniciansPage() {
  const { isAdmin, user } = useAuth();
  const team = useTeam();
  const workload = useTodayWorkload();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Access updated.");
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't update that team member.")),
  });

  return (
    <AppShell>
      <PageHeader
        title="Technicians"
        description="Your field team, their access level and today's assigned stops."
        actions={
          isAdmin ? (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" /> Add team member
            </Button>
          ) : null
        }
      />

      <div className="panel overflow-hidden">
        {team.isLoading ? (
          <LoadingRows rows={4} cols={4} />
        ) : team.isError ? (
          <ErrorState
            message={friendlyError(team.error, "We couldn't load your team.")}
            onRetry={() => void team.refetch()}
          />
        ) : !team.data?.length ? (
          <EmptyState
            icon={Users}
            title="No team members yet"
            description="Add technicians so you can assign routes and track field work."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Access</th>
                  <th className="px-4 py-2.5 font-medium">Today</th>
                  <th className="px-4 py-2.5 font-medium">Active</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {team.data.map((m) => {
                  const load = workload.data?.get(m.id);
                  return (
                    <tr key={m.id} className="hover:bg-accent/25">
                      <td className="px-4 py-3">
                        <Link
                          to="/technicians/$techId"
                          params={{ techId: m.id }}
                          className="flex items-center gap-2.5 font-medium hover:underline"
                        >
                          <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                            {initials(m.first_name, m.last_name, "T")}
                          </span>
                          {personName(m, "Team member")}
                          {m.id === user?.id ? (
                            <span className="text-xs text-muted-foreground">(you)</span>
                          ) : null}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="block">{m.email ?? "—"}</span>
                        <span className="block text-xs">{m.phone ?? "No phone"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={m.role === "employee" ? "info" : "active"}
                          label={(m.role ? ROLE_LABELS[m.role] : null) ?? "No role"}
                        />
                      </td>
                      <td className="num px-4 py-3 text-muted-foreground">
                        {load ? `${load.done}/${load.total} stops` : "No stops"}
                      </td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={m.active}
                          disabled={!isAdmin || m.id === user?.id || toggleActive.isPending}
                          onCheckedChange={(active) => toggleActive.mutate({ id: m.id, active })}
                          aria-label="Active"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isAdmin ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditing(m);
                              setDialogOpen(true);
                            }}
                          >
                            <UserCog className="mr-1.5 size-4" /> Edit
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TechnicianDialog open={dialogOpen} onOpenChange={setDialogOpen} member={editing} />
    </AppShell>
  );
}
