import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronRight as Chevron,
  MapPin,
  Navigation,
  Phone,
  Play,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/shell/app-shell";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/shell/status-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  addDays,
  clockTime,
  customerName,
  friendlyError,
  fullAddress,
  mapsHref,
  telHref,
  today,
  weekdayDate,
} from "@/lib/format";

export const Route = createFileRoute("/_authenticated/my-day")({
  head: () => ({
    meta: [
      { title: "My Day — AquaLedger" },
      {
        name: "description",
        content: "A technician's stop-by-stop pool service day, built for phones in the field.",
      },
      { property: "og:title", content: "My Day — AquaLedger" },
      { property: "og:description", content: "Today's route and service workflow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyDayPage,
});

function MyDayPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(today());

  const stops = useQuery({
    queryKey: ["my-day", date, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [assigned, routeDay] = await Promise.all([
        supabase
          .from("service_records")
          .select(
            "id, status, scheduled_time, estimated_duration_minutes, customers(first_name, last_name, company_name, phone), properties(property_name, address, city, state, zip, gate_code), route_stops(position)",
          )
          .eq("service_date", date)
          .eq("technician_id", user!.id),
        supabase
          .from("route_days")
          .select("notes")
          .eq("route_date", date)
          .eq("technician_id", user!.id)
          .maybeSingle(),
      ]);
      if (assigned.error) throw assigned.error;
      const list = assigned.data ?? [];
      list.sort((a, b) => {
        const pa = a.route_stops?.position ?? 999;
        const pb = b.route_stops?.position ?? 999;
        if (pa !== pb) return pa - pb;
        return (a.scheduled_time ?? "99").localeCompare(b.scheduled_time ?? "99");
      });
      return { list, notes: routeDay.data?.notes ?? null };
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: Database["public"]["Tables"]["service_records"]["Update"] = { status };
      if (status === "in_progress") patch.started_at = new Date().toISOString();
      if (status === "completed") patch.completed_at = new Date().toISOString();
      const { error } = await supabase.from("service_records").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-day"] });
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't update that stop.")),
  });

  const list = stops.data?.list ?? [];
  const done = list.filter((s) => s.status === "completed").length;

  return (
    <AppShell>
      <PageHeader
        title="My day"
        description={`${weekdayDate(date)} · ${done}/${list.length} stops complete`}
        actions={
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous day"
              onClick={() => setDate((d) => addDays(d, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDate(today())}>
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next day"
              onClick={() => setDate((d) => addDays(d, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />

      {stops.data?.notes ? (
        <p className="panel mb-4 p-3 text-sm text-muted-foreground">{stops.data.notes}</p>
      ) : null}

      {stops.isLoading ? (
        <div className="panel">
          <LoadingRows rows={4} cols={2} />
        </div>
      ) : stops.isError ? (
        <div className="panel">
          <ErrorState
            message={friendlyError(stops.error, "We couldn't load your day.")}
            onRetry={() => void stops.refetch()}
          />
        </div>
      ) : !list.length ? (
        <div className="panel">
          <EmptyState
            icon={MapPin}
            title="No stops assigned"
            description="Nothing is assigned to you for this day. Check with your office or pick another date."
          />
        </div>
      ) : (
        <ol className="space-y-3">
          {list.map((s, index) => (
            <li key={s.id} className="panel p-4">
              <div className="flex items-start gap-3">
                <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/services/$serviceId"
                    params={{ serviceId: s.id }}
                    className="flex items-center gap-1 text-base font-semibold hover:underline"
                  >
                    <span className="truncate">{customerName(s.customers)}</span>
                    <Chevron className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                  <p className="text-sm text-muted-foreground">{fullAddress(s.properties)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.scheduled_time ? clockTime(s.scheduled_time) : "Any time"} ·{" "}
                    {s.estimated_duration_minutes} min
                    {s.properties?.gate_code ? ` · Gate ${s.properties.gate_code}` : ""}
                  </p>
                </div>
                <StatusBadge status={s.status} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={mapsHref(s.properties)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-1 items-center justify-center rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent sm:flex-none"
                >
                  <MapPin className="mr-1.5 size-4" /> Directions
                </a>
                {s.customers?.phone ? (
                  <a
                    href={telHref(s.customers.phone)}
                    className="inline-flex flex-1 items-center justify-center rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent sm:flex-none"
                  >
                    <Phone className="mr-1.5 size-4" /> Call
                  </a>
                ) : null}
                {s.status === "scheduled" ? (
                  <Button
                    className="flex-1 sm:flex-none"
                    variant="outline"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: s.id, status: "en_route" })}
                  >
                    <Navigation className="mr-1.5 size-4" /> On my way
                  </Button>
                ) : null}
                {s.status === "scheduled" || s.status === "en_route" ? (
                  <Button
                    className="flex-1 sm:flex-none"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: s.id, status: "in_progress" })}
                  >
                    <Play className="mr-1.5 size-4" /> Start
                  </Button>
                ) : null}
                {s.status === "in_progress" ? (
                  <Button asChild className="flex-1 sm:flex-none">
                    <Link to="/services/$serviceId" params={{ serviceId: s.id }}>
                      <CheckCircle2 className="mr-1.5 size-4" /> Finish visit
                    </Link>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </AppShell>
  );
}
