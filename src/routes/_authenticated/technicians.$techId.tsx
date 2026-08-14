import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Gauge, Mail, Phone } from "lucide-react";

import { AppShell } from "@/components/shell/app-shell";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/shell/status-badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  DAY_LABELS,
  ROLE_LABELS,
  addDays,
  clockTime,
  customerName,
  friendlyError,
  initials,
  money,
  personName,
  shortDate,
  telHref,
  today,
} from "@/lib/format";

export const Route = createFileRoute("/_authenticated/technicians/$techId")({
  head: () => ({
    meta: [
      { title: "Technician — AquaLedger" },
      { name: "description", content: "Technician profile, assigned service plans and workload." },
      { property: "og:title", content: "Technician — AquaLedger" },
      { property: "og:description", content: "Assigned plans and upcoming visits." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TechnicianDetailPage,
  errorComponent: () => (
    <AppShell>
      <ErrorState message="We couldn't load this technician." />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <EmptyState icon={Gauge} title="Technician not found" />
    </AppShell>
  ),
});

function TechnicianDetailPage() {
  const { techId } = Route.useParams();
  const { isAdmin } = useAuth();
  const from = today();
  const to = addDays(from, 14);

  const detail = useQuery({
    queryKey: ["technician", techId],
    queryFn: async () => {
      const [profileRes, rolesRes, plansRes, upcomingRes, recentRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, first_name, last_name, email, phone, active, created_at")
          .eq("id", techId)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", techId),
        supabase
          .from("service_plans")
          .select(
            "id, service_name, frequency, price, preferred_day, preferred_window_start, estimated_duration_minutes, status, customers(first_name, last_name, company_name), properties(address, city)",
          )
          .eq("technician_id", techId)
          .order("preferred_day", { ascending: true }),
        supabase
          .from("service_records")
          .select(
            "id, service_date, scheduled_time, status, customers(first_name, last_name, company_name), properties(address, city)",
          )
          .eq("technician_id", techId)
          .gte("service_date", from)
          .lte("service_date", to)
          .order("service_date", { ascending: true }),
        supabase
          .from("service_records")
          .select("id, service_date, status, actual_duration_minutes")
          .eq("technician_id", techId)
          .lt("service_date", from)
          .order("service_date", { ascending: false })
          .limit(60),
      ]);
      if (profileRes.error) throw profileRes.error;
      const recent = recentRes.data ?? [];
      const completed = recent.filter((r) => r.status === "completed");
      return {
        profile: profileRes.data,
        role: (rolesRes.data ?? [])[0]?.role ?? null,
        plans: plansRes.data ?? [],
        upcoming: upcomingRes.data ?? [],
        completedCount: completed.length,
        avgMinutes: completed.length
          ? Math.round(
              completed.reduce((s, r) => s + (r.actual_duration_minutes ?? 0), 0) /
                completed.length,
            )
          : 0,
      };
    },
  });

  const d = detail.data;

  return (
    <AppShell>
      <PageHeader
        title={personName(d?.profile, "Technician")}
        description={
          d?.role
            ? `${ROLE_LABELS[d.role] ?? "Team member"} · ${d.profile?.active ? "Active" : "Inactive"}`
            : "Team member"
        }
        actions={
          isAdmin ? (
            <Link
              to="/routes"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              Plan routes
            </Link>
          ) : null
        }
      />

      {detail.isLoading ? (
        <div className="panel">
          <LoadingRows rows={5} cols={3} />
        </div>
      ) : detail.isError ? (
        <div className="panel">
          <ErrorState
            message={friendlyError(detail.error, "We couldn't load this technician.")}
            onRetry={() => void detail.refetch()}
          />
        </div>
      ) : !d?.profile ? (
        <div className="panel">
          <EmptyState icon={Gauge} title="Technician not found" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="panel flex items-center gap-3 p-4">
              <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                {initials(d.profile.first_name, d.profile.last_name, "T")}
              </span>
              <div className="min-w-0 text-sm">
                <a
                  href={`mailto:${d.profile.email ?? ""}`}
                  className="flex items-center gap-1.5 truncate hover:underline"
                >
                  <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                  {d.profile.email ?? "—"}
                </a>
                <a
                  href={telHref(d.profile.phone)}
                  className="flex items-center gap-1.5 text-muted-foreground hover:underline"
                >
                  <Phone className="size-3.5 shrink-0" />
                  {d.profile.phone ?? "No phone"}
                </a>
              </div>
            </div>
            <StatBox label="Assigned plans" value={String(d.plans.length)} />
            <StatBox label="Completed visits" value={String(d.completedCount)} />
            <StatBox
              label="Avg visit time"
              value={d.avgMinutes ? `${d.avgMinutes} min` : "—"}
            />
          </div>

          <section className="panel mt-6">
            <header className="border-b border-border px-4 py-3">
              <h2 className="font-display text-sm font-semibold">Assigned service plans</h2>
            </header>
            {d.plans.length ? (
              <ul className="divide-y divide-border">
                {d.plans.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.service_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {customerName(p.customers)} · {p.properties?.address}
                        {p.properties?.city ? `, ${p.properties.city}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {p.preferred_day === null ? "Any day" : DAY_LABELS[p.preferred_day]}
                      {p.preferred_window_start
                        ? ` · ${clockTime(p.preferred_window_start)}`
                        : ""}
                    </span>
                    <span className="num text-sm font-medium">{money(p.price)}</span>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Gauge}
                title="No plans assigned"
                description="Assign this technician on a service plan to build their weekly route."
              />
            )}
          </section>

          <section className="panel mt-6">
            <header className="border-b border-border px-4 py-3">
              <h2 className="font-display text-sm font-semibold">Next 14 days</h2>
            </header>
            {d.upcoming.length ? (
              <ul className="divide-y divide-border">
                {d.upcoming.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/services/$serviceId"
                        params={{ serviceId: s.id }}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {customerName(s.customers)}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.properties?.address}
                      </p>
                    </div>
                    <span className="num text-xs text-muted-foreground">
                      {shortDate(s.service_date)}
                      {s.scheduled_time ? ` · ${clockTime(s.scheduled_time)}` : ""}
                    </span>
                    <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="Nothing scheduled"
                description="Generate upcoming visits from the schedule page."
              />
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="num mt-2 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
