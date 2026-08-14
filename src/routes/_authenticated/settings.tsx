import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : "company",
  }),
  head: () => ({
    meta: [
      { title: "Settings — AquaLedger" },
      { name: "description", content: "Company profile, team members and account preferences." },
      { property: "og:title", content: "Settings — AquaLedger" },
      { property: "og:description", content: "Company profile, team and account settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { tab } = Route.useSearch();
  const { organization, profile, role } = useAuth();

  const team = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, user_roles(role)")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell>
      <PageHeader title="Settings" description="Company details, your team and your account." />

      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="panel mt-4 space-y-2 p-4 text-sm">
          <Field label="Company" value={organization?.name ?? "—"} />
          <Field label="Email" value={organization?.email ?? "—"} />
          <Field label="Phone" value={organization?.phone ?? "—"} />
          <Field
            label="Default tax rate"
            value={
              organization?.default_tax_rate != null
                ? `${organization.default_tax_rate}%`
                : "—"
            }
          />
        </TabsContent>

        <TabsContent value="team" className="panel mt-4 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(team.data ?? []).map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    {m.first_name} {m.last_name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {m.user_roles?.map((r) => ROLE_LABELS[r.role] ?? r.role).join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="account" className="panel mt-4 space-y-2 p-4 text-sm">
          <Field label="Name" value={`${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`} />
          <Field label="Email" value={profile?.email ?? "—"} />
          <Field label="Role" value={role ? (ROLE_LABELS[role] ?? role) : "—"} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
