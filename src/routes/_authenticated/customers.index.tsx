import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Loader2, Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/shell/app-shell";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { customerName, downloadCsv, friendlyError } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/customers/")({
  head: () => ({
    meta: [
      { title: "Customers — AquaLedger" },
      {
        name: "description",
        content: "All pool service customers with contact details, properties and billing info.",
      },
      { property: "og:title", content: "Customers — AquaLedger" },
      { property: "og:description", content: "Manage your pool service customer list." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [scope, setScope] = useState<"active" | "inactive" | "all">("active");
  const [dialogOpen, setDialogOpen] = useState(false);

  const customers = useQuery({
    queryKey: ["customers", scope],
    queryFn: async () => {
      let q = supabase
        .from("customers")
        .select(
          "id, first_name, last_name, company_name, email, phone, billing_city, billing_state, active, properties(count)",
        )
        .order("created_at", { ascending: false });
      if (scope !== "all") q = q.eq("active", scope === "active");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const setActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("customers").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Customer updated.");
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't update that customer.")),
  });

  const rows = useMemo(() => {
    const list = customers.data ?? [];
    const t = term.trim().toLowerCase();
    if (!t) return list;
    return list.filter((c) =>
      [c.first_name, c.last_name, c.company_name, c.email, c.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t)),
    );
  }, [customers.data, term]);

  return (
    <AppShell>
      <PageHeader
        title="Customers"
        description="Everyone you service, with contact and billing details."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv("customers.csv", [
                  ["Name", "Company", "Email", "Phone", "City", "State", "Active"],
                  ...rows.map((c) => [
                    [c.first_name, c.last_name].filter(Boolean).join(" "),
                    c.company_name,
                    c.email,
                    c.phone,
                    c.billing_city,
                    c.billing_state,
                    c.active ? "Yes" : "No",
                  ]),
                ])
              }
              disabled={!rows.length}
            >
              <Download className="mr-2 size-4" /> Export
            </Button>
            {isAdmin ? (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 size-4" /> New customer
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, company, email or phone"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="panel overflow-hidden">
        {customers.isLoading ? (
          <LoadingRows rows={6} cols={5} />
        ) : customers.isError ? (
          <ErrorState
            message={friendlyError(customers.error, "We couldn't load your customers.")}
            onRetry={() => void customers.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={term ? "No matching customers" : "No customers yet"}
            description={
              term
                ? "Try a different name, email or phone number."
                : "Add your first customer to start building properties, service plans and invoices."
            }
            action={
              isAdmin && !term ? (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 size-4" /> New customer
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Location</th>
                  <th className="px-4 py-2.5 font-medium">Properties</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-accent/25">
                    <td className="px-4 py-3">
                      <Link
                        to="/customers/$customerId"
                        params={{ customerId: c.id }}
                        className="font-medium hover:underline"
                      >
                        {customerName(c)}
                      </Link>
                      {!c.active ? (
                        <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="block">{c.email || "—"}</span>
                      <span className="block text-xs">{c.phone || ""}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[c.billing_city, c.billing_state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="num px-4 py-3 text-muted-foreground">
                      {c.properties?.[0]?.count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={setActive.isPending}
                          onClick={() => setActive.mutate({ id: c.id, active: !c.active })}
                        >
                          {setActive.isPending ? (
                            <Loader2 className="mr-2 size-3.5 animate-spin" />
                          ) : null}
                          {c.active ? "Deactivate" : "Reactivate"}
                        </Button>
                      ) : null}
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/customers/$customerId" params={{ customerId: c.id }}>
                          View
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </AppShell>
  );
}
