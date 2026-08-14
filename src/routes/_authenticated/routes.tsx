import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Route as RouteIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/shell/app-shell";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/shell/status-badge";
import { Button } from "@/components/ui/button";
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
import { useTechnicianOptions } from "@/hooks/useTechnicians";
import { supabase } from "@/integrations/supabase/client";
import {
  addDays,
  clockTime,
  customerName,
  friendlyError,
  fullAddress,
  mapsHref,
  personName,
  today,
  weekdayDate,
} from "@/lib/format";

export const Route = createFileRoute("/_authenticated/routes")({
  head: () => ({
    meta: [
      { title: "Routes — AquaLedger" },
      {
        name: "description",
        content: "Build and reorder daily technician routes for pool service stops.",
      },
      { property: "og:title", content: "Routes — AquaLedger" },
      { property: "og:description", content: "Daily route planning for your technicians." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoutesPage,
});

type Stop = {
  id: string;
  status: string;
  scheduled_time: string | null;
  technician_id: string | null;
  customers: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
  } | null;
  properties: {
    property_name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null;
  route_stops: { position: number } | null;
};

function RoutesPage() {
  const { organization, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(today());
  const [techId, setTechId] = useState<string>("");
  const technicians = useTechnicianOptions();
  const [order, setOrder] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!techId && user?.id) setTechId(user.id);
  }, [techId, user?.id]);

  const day = useQuery({
    queryKey: ["route-day", date, techId],
    enabled: !!techId,
    queryFn: async () => {
      const [dayRes, stopsRes, unassignedRes] = await Promise.all([
        supabase
          .from("route_days")
          .select("id, notes")
          .eq("route_date", date)
          .eq("technician_id", techId)
          .maybeSingle(),
        supabase
          .from("service_records")
          .select(
            "id, status, scheduled_time, technician_id, customers(first_name, last_name, company_name), properties(property_name, address, city, state, zip), route_stops(position)",
          )
          .eq("service_date", date)
          .eq("technician_id", techId),
        supabase
          .from("service_records")
          .select(
            "id, status, scheduled_time, technician_id, customers(first_name, last_name, company_name), properties(property_name, address, city, state, zip), route_stops(position)",
          )
          .eq("service_date", date)
          .is("technician_id", null),
      ]);
      if (stopsRes.error) throw stopsRes.error;
      const stops = (stopsRes.data ?? []) as Stop[];
      stops.sort((a, b) => {
        const pa = a.route_stops?.position ?? 999;
        const pb = b.route_stops?.position ?? 999;
        if (pa !== pb) return pa - pb;
        return (a.scheduled_time ?? "99").localeCompare(b.scheduled_time ?? "99");
      });
      return {
        routeDay: dayRes.data,
        stops,
        unassigned: (unassignedRes.data ?? []) as Stop[],
      };
    },
  });

  useEffect(() => {
    if (!day.data) return;
    setOrder(day.data.stops.map((s) => s.id));
    setNotes(day.data.routeDay?.notes ?? "");
    setDirty(false);
  }, [day.data]);

  const stopsById = new Map((day.data?.stops ?? []).map((s) => [s.id, s]));
  const ordered = order.map((id) => stopsById.get(id)).filter(Boolean) as Stop[];

  function move(index: number, delta: number) {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    setOrder(next);
    setDirty(true);
  }

  const saveOrder = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error("Your company workspace is still loading.");
      let routeDayId = day.data?.routeDay?.id;
      if (!routeDayId) {
        const created = await supabase
          .from("route_days")
          .insert({
            organization_id: organization.id,
            route_date: date,
            technician_id: techId,
            notes: notes.trim() || null,
          })
          .select("id")
          .single();
        if (created.error) throw created.error;
        routeDayId = created.data.id;
      } else {
        const upd = await supabase
          .from("route_days")
          .update({ notes: notes.trim() || null })
          .eq("id", routeDayId);
        if (upd.error) throw upd.error;
      }
      const { error } = await supabase.rpc("save_route_order", {
        p_route_day_id: routeDayId,
        p_service_ids: order,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Route saved.");
      setDirty(false);
      await queryClient.invalidateQueries({ queryKey: ["route-day"] });
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't save this route.")),
  });

  const assign = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase
        .from("service_records")
        .update({ technician_id: techId })
        .eq("id", serviceId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Stop added to this route.");
      await queryClient.invalidateQueries({ queryKey: ["route-day"] });
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't assign that stop.")),
  });

  return (
    <AppShell>
      <PageHeader
        title="Routes"
        description="Order the stops for one technician's day, then save the route."
        actions={
          <Button disabled={!dirty || saveOrder.isPending} onClick={() => saveOrder.mutate()}>
            {saveOrder.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save route order
          </Button>
        }
      />

      <div className="panel mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="route-date">Date</Label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous day"
              onClick={() => setDate((d) => addDays(d, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Input
              id="route-date"
              type="date"
              className="w-40"
              value={date}
              onChange={(e) => setDate(e.target.value || today())}
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Next day"
              onClick={() => setDate((d) => addDays(d, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Technician</Label>
          <Select value={techId} onValueChange={setTechId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a technician" />
            </SelectTrigger>
            <SelectContent>
              {(technicians.data ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {personName(t, "Team member")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[16rem] flex-1 space-y-1.5">
          <Label htmlFor="route-notes">Route notes</Label>
          <Textarea
            id="route-notes"
            rows={2}
            placeholder="Anything the technician should know about today"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setDirty(true);
            }}
          />
        </div>
      </div>

      <section className="panel">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-sm font-semibold">{weekdayDate(date)}</h2>
          <span className="text-xs text-muted-foreground">{ordered.length} stops</span>
        </header>
        {day.isLoading ? (
          <LoadingRows rows={5} cols={3} />
        ) : day.isError ? (
          <ErrorState
            message={friendlyError(day.error, "We couldn't load this route.")}
            onRetry={() => void day.refetch()}
          />
        ) : !ordered.length ? (
          <EmptyState
            icon={RouteIcon}
            title="No stops for this day"
            description="Assign visits to this technician, or generate upcoming visits from the schedule."
          />
        ) : (
          <ol className="divide-y divide-border">
            {ordered.map((s, index) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/services/$serviceId"
                    params={{ serviceId: s.id }}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {customerName(s.customers)}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {fullAddress(s.properties)}
                  </p>
                </div>
                <span className="num hidden text-xs text-muted-foreground sm:block">
                  {s.scheduled_time ? clockTime(s.scheduled_time) : "Any time"}
                </span>
                <StatusBadge status={s.status} />
                <a
                  href={mapsHref(s.properties)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Directions"
                  className="rounded-md border border-input p-1.5 hover:bg-accent"
                >
                  <MapPin className="size-4" />
                </a>
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={index === ordered.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {isAdmin && day.data?.unassigned.length ? (
        <section className="panel mt-6">
          <header className="border-b border-border px-4 py-3">
            <h2 className="font-display text-sm font-semibold">Unassigned stops this day</h2>
          </header>
          <ul className="divide-y divide-border">
            {day.data.unassigned.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{customerName(s.customers)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {fullAddress(s.properties)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!techId || assign.isPending}
                  onClick={() => assign.mutate(s.id)}
                >
                  Add to route
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
