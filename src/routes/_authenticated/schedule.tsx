import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/shell/app-shell";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/shell/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useTechnicianOptions } from "@/hooks/useTechnicians";
import { supabase } from "@/integrations/supabase/client";
import {
  DAY_SHORT,
  addDays,
  clockTime,
  customerName,
  dayOfWeek,
  friendlyError,
  monthLabel,
  personName,
  shortDate,
  today,
  weekStart,
  weekdayDate,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule — AquaLedger" },
      {
        name: "description",
        content: "Day, week and month views of every scheduled pool service visit.",
      },
      { property: "og:title", content: "Schedule — AquaLedger" },
      { property: "og:description", content: "Plan and generate upcoming service visits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SchedulePage,
});

type View = "day" | "week" | "month";

type Visit = {
  id: string;
  service_date: string;
  scheduled_time: string | null;
  status: string;
  technician_id: string | null;
  customers: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  } | null;
  properties: { address: string | null; city: string | null } | null;
  profiles: { first_name: string | null; last_name: string | null; email: string | null } | null;
};

function monthGrid(anchor: string): { start: string; end: string; cells: string[] } {
  const [y, m] = anchor.split("-").map(Number);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const start = addDays(first, -dayOfWeek(first));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return { start, end: cells[41]!, cells };
}

function SchedulePage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(today());
  const [techFilter, setTechFilter] = useState("all");
  const technicians = useTechnicianOptions();

  const range =
    view === "day"
      ? { from: anchor, to: anchor }
      : view === "week"
        ? { from: weekStart(anchor), to: addDays(weekStart(anchor), 6) }
        : { from: monthGrid(anchor).start, to: monthGrid(anchor).end };

  const visits = useQuery({
    queryKey: ["schedule", range.from, range.to, techFilter],
    queryFn: async () => {
      let q = supabase
        .from("service_records")
        .select(
          "id, service_date, scheduled_time, status, technician_id, customers(first_name, last_name, company_name), properties(address, city), profiles!service_records_technician_id_fkey(first_name, last_name, email)",
        )
        .gte("service_date", range.from)
        .lte("service_date", range.to)
        .order("service_date", { ascending: true })
        .order("scheduled_time", { ascending: true, nullsFirst: false });
      if (techFilter === "unassigned") q = q.is("technician_id", null);
      else if (techFilter !== "all") q = q.eq("technician_id", techFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Visit[];
    },
  });

  const generate = useMutation({
    mutationFn: async (weeks: number) => {
      const { data, error } = await supabase.rpc("generate_service_records", { p_weeks: weeks });
      if (error) throw error;
      return data ?? 0;
    },
    onSuccess: async (count) => {
      toast.success(
        count ? `Generated ${count} upcoming visits.` : "Every plan is already scheduled.",
      );
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't generate upcoming visits.")),
  });

  const step = view === "day" ? 1 : view === "week" ? 7 : 30;
  const byDate = new Map<string, Visit[]>();
  for (const v of visits.data ?? []) {
    const list = byDate.get(v.service_date) ?? [];
    list.push(v);
    byDate.set(v.service_date, list);
  }

  return (
    <AppShell>
      <PageHeader
        title="Schedule"
        description="Every scheduled visit by day, week or month."
        actions={
          isAdmin ? (
            <Button disabled={generate.isPending} onClick={() => generate.mutate(6)}>
              {generate.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-4" />
              )}
              Generate 6 weeks
            </Button>
          ) : null
        }
      />

      <div className="panel mb-6 flex flex-wrap items-center gap-3 p-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous"
            onClick={() => setAnchor((a) => addDays(a, -step))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(today())}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next"
            onClick={() => setAnchor((a) => addDays(a, step))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <p className="font-display text-sm font-semibold">
          {view === "day"
            ? weekdayDate(anchor)
            : view === "week"
              ? `${shortDate(range.from)} – ${shortDate(range.to)}`
              : monthLabel(anchor)}
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={techFilter} onValueChange={setTechFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All technicians</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {(technicians.data ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {personName(t, "Team member")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {visits.isLoading ? (
        <div className="panel">
          <LoadingRows rows={6} cols={3} />
        </div>
      ) : visits.isError ? (
        <div className="panel">
          <ErrorState
            message={friendlyError(visits.error, "We couldn't load the schedule.")}
            onRetry={() => void visits.refetch()}
          />
        </div>
      ) : view === "month" ? (
        <MonthView anchor={anchor} byDate={byDate} />
      ) : (
        <div
          className={cn(
            "grid gap-4",
            view === "week" ? "sm:grid-cols-2 xl:grid-cols-4" : "grid-cols-1",
          )}
        >
          {(view === "day"
            ? [anchor]
            : Array.from({ length: 7 }, (_, i) => addDays(range.from, i))
          ).map((date) => (
            <section key={date} className="panel">
              <header className="flex items-center justify-between border-b border-border px-3 py-2">
                <h2 className="text-sm font-semibold">{weekdayDate(date)}</h2>
                <span className="num text-xs text-muted-foreground">
                  {(byDate.get(date) ?? []).length}
                </span>
              </header>
              {(byDate.get(date) ?? []).length ? (
                <ul className="divide-y divide-border">
                  {(byDate.get(date) ?? []).map((v) => (
                    <li key={v.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/services/$serviceId"
                          params={{ serviceId: v.id }}
                          className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                        >
                          {customerName(v.customers)}
                        </Link>
                        <StatusBadge status={v.status} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {v.scheduled_time ? `${clockTime(v.scheduled_time)} · ` : ""}
                        {v.properties?.address}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {personName(v.profiles)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">No visits</p>
              )}
            </section>
          ))}
        </div>
      )}

      {!visits.isLoading && !visits.data?.length ? (
        <div className="panel mt-6">
          <EmptyState
            icon={CalendarClock}
            title="Nothing scheduled in this range"
            description="Generate upcoming visits from your active service plans to fill the calendar."
            action={
              isAdmin ? (
                <Button onClick={() => generate.mutate(6)} disabled={generate.isPending}>
                  Generate upcoming visits
                </Button>
              ) : null
            }
          />
        </div>
      ) : null}
    </AppShell>
  );
}

function MonthView({ anchor, byDate }: { anchor: string; byDate: Map<string, Visit[]> }) {
  const { cells } = monthGrid(anchor);
  const month = anchor.slice(0, 7);
  const now = today();
  return (
    <div className="panel overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs uppercase tracking-wide text-muted-foreground">
        {DAY_SHORT.map((d) => (
          <span key={d} className="py-2">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date) => {
          const list = byDate.get(date) ?? [];
          const outside = !date.startsWith(month);
          return (
            <div
              key={date}
              className={cn(
                "min-h-24 border-b border-r border-border p-1.5 text-xs",
                outside && "bg-muted/30 text-muted-foreground",
                date === now && "bg-primary/5",
              )}
            >
              <span className={cn("num", date === now && "font-semibold text-primary")}>
                {Number(date.slice(8))}
              </span>
              <ul className="mt-1 space-y-1">
                {list.slice(0, 3).map((v) => (
                  <li key={v.id}>
                    <Link
                      to="/services/$serviceId"
                      params={{ serviceId: v.id }}
                      className="block truncate rounded bg-secondary px-1.5 py-0.5 hover:bg-accent"
                    >
                      {v.scheduled_time ? `${clockTime(v.scheduled_time)} ` : ""}
                      {customerName(v.customers)}
                    </Link>
                  </li>
                ))}
                {list.length > 3 ? (
                  <li className="text-muted-foreground">+{list.length - 3} more</li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
