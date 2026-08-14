import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  CircleDollarSign,
  Gauge,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/shell/app-shell";
import { EmptyState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/shell/status-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { addDays, customerName, friendlyError, money, num, shortDate, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AquaLedger" },
      {
        name: "description",
        content: "Today's pool service workload, receivables and revenue at a glance.",
      },
      { property: "og:title", content: "Dashboard — AquaLedger" },
      { property: "og:description", content: "Pool service workload and revenue overview." },
    ],
  }),
  component: DashboardPage,
});

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function DashboardPage() {
  const { profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const from = today();
  const to = addDays(from, 7);

  const overview = useQuery({
    queryKey: ["dashboard", from],
    queryFn: async () => {
      const [
        customers,
        plans,
        upcoming,
        openInvoices,
        monthPayments,
        recentServices,
        todayStops,
      ] = await Promise.all([
          supabase.from("customers").select("id", { count: "exact", head: true }).eq("active", true),
          supabase
            .from("service_plans")
            .select("id", { count: "exact", head: true })
            .eq("status", "active"),
          supabase
            .from("service_records")
            .select(
              "id, service_date, status, customers(first_name, last_name, company_name), properties(address, city)",
            )
            .gte("service_date", from)
            .lte("service_date", to)
            .order("service_date", { ascending: true })
            .limit(8),
          supabase
            .from("invoices")
            .select(
              "id, invoice_number, status, due_date, amount_due, total, customers(first_name, last_name, company_name)",
            )
            .in("status", ["sent", "partially_paid", "overdue"])
            .order("due_date", { ascending: true })
            .limit(50),
          supabase
            .from("payments")
            .select("amount")
            .eq("status", "completed")
            .gte("payment_date", monthStart()),
          supabase
            .from("service_records")
            .select(
              "id, service_date, status, customers(first_name, last_name, company_name), properties(address)",
            )
            .eq("status", "completed")
            .order("service_date", { ascending: false })
            .limit(6),
          supabase
            .from("service_records")
            .select("id, status, technician_id")
            .eq("service_date", from),
        ]);

      const invoices = openInvoices.data ?? [];
      const stops = todayStops.data ?? [];
      return {
        customerCount: customers.count ?? 0,
        planCount: plans.count ?? 0,
        upcoming: upcoming.data ?? [],
        openInvoices: invoices,
        outstanding: invoices.reduce((sum, i) => sum + num(i.amount_due), 0),
        overdue: invoices.filter((i) => i.status === "overdue"),
        collectedThisMonth: (monthPayments.data ?? []).reduce((s, p) => s + num(p.amount), 0),
        recentServices: recentServices.data ?? [],
        todayTotal: stops.length,
        todayDone: stops.filter((s) => s.status === "completed").length,
        todayUnassigned: stops.filter((s) => !s.technician_id).length,
      };
    },
  });

  const seed = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("seed_demo_data");
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Sample data loaded.");
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't load the sample data.")),
  });

  const d = overview.data;
  const isEmpty = !!d && d.customerCount === 0 && d.planCount === 0 && d.openInvoices.length === 0;

  return (
    <AppShell>
      <PageHeader
        title={`Welcome${profile?.first_name ? `, ${profile.first_name}` : ""}`}
        description="Your service week, receivables and revenue overview."
        actions={
          isAdmin ? (
            <Button asChild>
              <Link to="/customers">Add work</Link>
            </Button>
          ) : null
        }
      />

      {isEmpty ? (
        <div className="panel p-2">
          <EmptyState
            icon={Sparkles}
            title="Your workspace is ready"
            description="Add your first customer, or load a full set of sample customers, properties, service plans, invoices and payments to explore the app."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link to="/customers">Add your first customer</Link>
                </Button>
                {isAdmin ? (
                  <Button
                    variant="outline"
                    onClick={() => seed.mutate()}
                    disabled={seed.isPending}
                  >
                    {seed.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Load sample data
                  </Button>
                ) : null}
              </div>
            }
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Active customers"
          value={overview.isLoading ? "…" : String(d?.customerCount ?? 0)}
          to="/customers"
        />
        <StatCard
          icon={Gauge}
          label="Active service plans"
          value={overview.isLoading ? "…" : String(d?.planCount ?? 0)}
          to="/service-plans"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Outstanding receivables"
          value={overview.isLoading ? "…" : money(d?.outstanding)}
          hint={d?.overdue.length ? `${d.overdue.length} overdue` : "Nothing overdue"}
          to="/invoices"
        />
        <StatCard
          icon={CalendarClock}
          label="Collected this month"
          value={overview.isLoading ? "…" : money(d?.collectedThisMonth)}
          to="/payments"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ClipboardCheck}
          label="Stops today"
          value={overview.isLoading ? "…" : `${d?.todayDone ?? 0}/${d?.todayTotal ?? 0}`}
          hint="Completed vs. scheduled"
          to="/my-day"
        />
        <StatCard
          icon={CalendarClock}
          label="Unassigned today"
          value={overview.isLoading ? "…" : String(d?.todayUnassigned ?? 0)}
          hint="Stops without a technician"
          to="/schedule"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-display text-sm font-semibold">Next 7 days</h2>
            <Link to="/service-history" className="text-xs font-medium text-primary hover:underline">
              Service history
            </Link>
          </header>
          {overview.isLoading ? (
            <LoadingRows rows={4} cols={3} />
          ) : d?.upcoming.length ? (
            <ul className="divide-y divide-border">
              {d.upcoming.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{customerName(s.customers)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.properties?.address}
                      {s.properties?.city ? `, ${s.properties.city}` : ""}
                    </p>
                  </div>
                  <span className="num text-xs text-muted-foreground">
                    {shortDate(s.service_date)}
                  </span>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="No visits scheduled"
              description="Schedule visits from a service plan or log them directly in service history."
            />
          )}
        </section>

        <section className="panel">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-display text-sm font-semibold">Needs attention</h2>
            <Link to="/invoices" className="text-xs font-medium text-primary hover:underline">
              All invoices
            </Link>
          </header>
          {overview.isLoading ? (
            <LoadingRows rows={4} cols={3} />
          ) : d?.openInvoices.length ? (
            <ul className="divide-y divide-border">
              {d.openInvoices.slice(0, 8).map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/invoices/$invoiceId"
                      params={{ invoiceId: i.id }}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {i.invoice_number}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {customerName(i.customers)} · due {shortDate(i.due_date)}
                    </p>
                  </div>
                  <span className="num text-sm font-medium">{money(i.amount_due)}</span>
                  <StatusBadge status={i.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={AlertTriangle}
              title="Nothing outstanding"
              description="Every issued invoice has been paid in full."
            />
          )}
        </section>
      </div>

      <section className="panel mt-6">
        <header className="border-b border-border px-4 py-3">
          <h2 className="font-display text-sm font-semibold">Recently completed service</h2>
        </header>
        {overview.isLoading ? (
          <LoadingRows rows={3} cols={3} />
        ) : d?.recentServices.length ? (
          <ul className="divide-y divide-border">
            {d.recentServices.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{customerName(s.customers)}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.properties?.address}</p>
                </div>
                <span className="num text-xs text-muted-foreground">
                  {shortDate(s.service_date)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="No completed visits yet"
            description="Completed visits will appear here as your team logs them."
          />
        )}
      </section>
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  to,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  to: "/customers" | "/service-plans" | "/invoices" | "/payments" | "/schedule" | "/my-day";
}) {
  return (
    <Link to={to} className="panel block p-4 transition-colors hover:bg-accent/30">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="num mt-2 font-display text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Link>
  );
}
