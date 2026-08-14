import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  Beaker,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Play,
  Plus,
  SkipForward,
  Trash2,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ServicePhotos } from "@/components/services/service-photos";
import { AppShell } from "@/components/shell/app-shell";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/shell/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  CHEMICAL_UNITS,
  CHEMISTRY_FIELDS,
  COMMON_CHEMICALS,
  EQUIPMENT_CONDITIONS,
  EQUIPMENT_TYPES,
  SKIP_REASONS,
  clockTime,
  customerName,
  dateTime,
  duration,
  friendlyError,
  fullAddress,
  mapsHref,
  personName,
  shortDate,
  telHref,
} from "@/lib/format";

export const Route = createFileRoute("/_authenticated/services/$serviceId")({
  head: () => ({
    meta: [
      { title: "Service Visit — AquaLedger" },
      {
        name: "description",
        content: "Complete a pool service visit: checklist, water chemistry, chemicals and photos.",
      },
      { property: "og:title", content: "Service Visit — AquaLedger" },
      { property: "og:description", content: "Field workflow for a single pool service visit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServiceDetailPage,
  errorComponent: () => (
    <AppShell>
      <ErrorState message="We couldn't load this service visit." />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <EmptyState icon={ClipboardList} title="Service visit not found" />
    </AppShell>
  ),
});

function ServiceDetailPage() {
  const { serviceId } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [skipOpen, setSkipOpen] = useState(false);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["service", serviceId] });
    await queryClient.invalidateQueries({ queryKey: ["my-day"] });
    await queryClient.invalidateQueries({ queryKey: ["schedule"] });
  };

  const service = useQuery({
    queryKey: ["service", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_records")
        .select(
          "*, customers(first_name, last_name, company_name, phone, email), properties(property_name, address, city, state, zip, access_notes, gate_code), pools(pool_name, pool_type, approximate_volume, surface_type, special_instructions), service_plans(service_name, estimated_duration_minutes), profiles!service_records_technician_id_fkey(first_name, last_name, email)",
        )
        .eq("id", serviceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const s = service.data;
  const canEdit = !!s && (isAdmin || s.technician_id === user?.id);
  const closed = s?.status === "completed" || s?.status === "cancelled" || s?.status === "skipped";

  const setStatus = useMutation({
    mutationFn: async (next: string) => {
      const patch: Database["public"]["Tables"]["service_records"]["Update"] = { status: next };
      if (next === "in_progress" && !s?.started_at) patch.started_at = new Date().toISOString();
      if (next === "completed") {
        const finished = new Date();
        patch.completed_at = finished.toISOString();
        const startedAt = s?.started_at ? new Date(s.started_at) : null;
        if (startedAt) {
          patch.actual_duration_minutes = Math.max(
            1,
            Math.round((finished.getTime() - startedAt.getTime()) / 60000),
          );
        }
      }
      if (next === "scheduled") {
        patch.started_at = null;
        patch.completed_at = null;
        patch.skip_reason = null;
        patch.skip_note = null;
      }
      const { error } = await supabase.from("service_records").update(patch).eq("id", serviceId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      router.invalidate();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't update this visit.")),
  });

  return (
    <AppShell>
      {service.isLoading ? (
        <div className="panel">
          <LoadingRows rows={6} cols={3} />
        </div>
      ) : service.isError ? (
        <div className="panel">
          <ErrorState
            message={friendlyError(service.error, "We couldn't load this service visit.")}
            onRetry={() => void service.refetch()}
          />
        </div>
      ) : !s ? (
        <div className="panel">
          <EmptyState
            icon={ClipboardList}
            title="Service visit not found"
            description="It may have been removed, or belongs to another technician."
          />
        </div>
      ) : (
        <>
          <PageHeader
            title={customerName(s.customers)}
            description={`${s.service_plans?.service_name ?? "Service visit"} · ${shortDate(s.service_date)}${
              s.scheduled_time ? ` at ${clockTime(s.scheduled_time)}` : ""
            }`}
            actions={<StatusBadge status={s.status} className="px-3 py-1 text-sm" />}
          />

          <div className="panel mb-6 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {s.status === "scheduled" ? (
                <Button
                  variant="outline"
                  disabled={!canEdit || setStatus.isPending}
                  onClick={() => setStatus.mutate("en_route")}
                >
                  <Navigation className="mr-2 size-4" /> On my way
                </Button>
              ) : null}
              {s.status === "scheduled" || s.status === "en_route" ? (
                <Button
                  disabled={!canEdit || setStatus.isPending}
                  onClick={() => setStatus.mutate("in_progress")}
                >
                  <Play className="mr-2 size-4" /> Start service
                </Button>
              ) : null}
              {s.status === "in_progress" ? (
                <Button
                  disabled={!canEdit || setStatus.isPending}
                  onClick={() => setStatus.mutate("completed")}
                >
                  {setStatus.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 size-4" />
                  )}
                  Complete service
                </Button>
              ) : null}
              {closed ? (
                <Button
                  variant="outline"
                  disabled={!canEdit || setStatus.isPending}
                  onClick={() =>
                    setStatus.mutate(s.status === "completed" ? "in_progress" : "scheduled")
                  }
                >
                  Reopen visit
                </Button>
              ) : (
                <Button variant="outline" disabled={!canEdit} onClick={() => setSkipOpen(true)}>
                  <SkipForward className="mr-2 size-4" /> Skip visit
                </Button>
              )}
              <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  Est. {duration(s.estimated_duration_minutes)}
                </span>
                {s.started_at ? <span>Started {dateTime(s.started_at)}</span> : null}
                {s.completed_at ? (
                  <span>
                    Finished {dateTime(s.completed_at)} · {duration(s.actual_duration_minutes)}
                  </span>
                ) : null}
              </span>
            </div>
            {s.skip_reason ? (
              <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
                Skipped — {SKIP_REASONS[s.skip_reason] ?? s.skip_reason}
                {s.skip_note ? `: ${s.skip_note}` : ""}
              </p>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Checklist serviceId={serviceId} canEdit={canEdit} />
              <Chemistry
                serviceId={serviceId}
                orgId={s.organization_id}
                poolId={s.pool_id}
                date={s.service_date}
                canEdit={canEdit}
              />
              <Chemicals
                serviceId={serviceId}
                orgId={s.organization_id}
                poolId={s.pool_id}
                canEdit={canEdit}
              />
              <Equipment
                serviceId={serviceId}
                orgId={s.organization_id}
                poolId={s.pool_id}
                canEdit={canEdit}
              />
              <ServicePhotos
                service={{
                  id: s.id,
                  organization_id: s.organization_id,
                  customer_id: s.customer_id,
                  property_id: s.property_id,
                  pool_id: s.pool_id,
                }}
                canEdit={canEdit}
              />
              <Notes
                serviceId={serviceId}
                internal={s.notes}
                customerVisible={s.customer_visible_notes}
                canEdit={canEdit}
                onSaved={invalidate}
              />
            </div>

            <div className="space-y-6">
              <section className="panel p-4">
                <h2 className="font-display text-sm font-semibold">Property</h2>
                <p className="mt-2 text-sm font-medium">
                  {s.properties?.property_name ?? s.properties?.address}
                </p>
                <p className="text-sm text-muted-foreground">{fullAddress(s.properties)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={mapsHref(s.properties)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    <MapPin className="mr-1.5 size-3.5" /> Directions
                  </a>
                  {s.customers?.phone ? (
                    <a
                      href={telHref(s.customers.phone)}
                      className="inline-flex items-center rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                    >
                      <Phone className="mr-1.5 size-3.5" /> Call customer
                    </a>
                  ) : null}
                </div>
                {s.properties?.gate_code ? (
                  <p className="mt-3 text-sm">
                    <span className="text-muted-foreground">Gate code: </span>
                    <span className="num font-medium">{s.properties.gate_code}</span>
                  </p>
                ) : null}
                {s.properties?.access_notes ? (
                  <p className="mt-2 text-sm text-muted-foreground">{s.properties.access_notes}</p>
                ) : null}
              </section>

              <section className="panel p-4">
                <h2 className="font-display text-sm font-semibold">Pool</h2>
                {s.pools ? (
                  <dl className="mt-2 space-y-1 text-sm">
                    <Row label="Name" value={s.pools.pool_name ?? "—"} />
                    <Row label="Type" value={s.pools.pool_type ?? "—"} />
                    <Row
                      label="Volume"
                      value={
                        s.pools.approximate_volume
                          ? `${s.pools.approximate_volume.toLocaleString()} gal`
                          : "—"
                      }
                    />
                    <Row label="Surface" value={s.pools.surface_type ?? "—"} />
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No pool linked to this visit.
                  </p>
                )}
                {s.pools?.special_instructions ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {s.pools.special_instructions}
                  </p>
                ) : null}
              </section>

              <section className="panel p-4">
                <h2 className="font-display text-sm font-semibold">Assignment</h2>
                <p className="mt-2 text-sm">{personName(s.profiles)}</p>
                <Link
                  to="/customers/$customerId"
                  params={{ customerId: s.customer_id }}
                  className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
                >
                  View customer record
                </Link>
              </section>
            </div>
          </div>

          <SkipDialog
            open={skipOpen}
            onOpenChange={setSkipOpen}
            serviceId={serviceId}
            onSaved={invalidate}
          />
        </>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Checklist({ serviceId, canEdit }: { serviceId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const items = useQuery({
    queryKey: ["service-checklist", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_checklist_items")
        .select("id, label, completed, position")
        .eq("service_record_id", serviceId)
        .order("position", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from("service_checklist_items")
        .update({ completed, completed_at: completed ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["service-checklist", serviceId] });
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't update the checklist.")),
  });

  const done = (items.data ?? []).filter((i) => i.completed).length;
  const total = items.data?.length ?? 0;

  return (
    <section className="panel">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold">Service checklist</h2>
        <span className="num text-xs text-muted-foreground">
          {done}/{total} done
        </span>
      </header>
      {items.isLoading ? (
        <LoadingRows rows={4} cols={1} />
      ) : total ? (
        <ul className="divide-y divide-border">
          {items.data!.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
              <Checkbox
                id={`chk-${i.id}`}
                checked={i.completed}
                disabled={!canEdit || toggle.isPending}
                onCheckedChange={(v) => toggle.mutate({ id: i.id, completed: v === true })}
              />
              <Label
                htmlFor={`chk-${i.id}`}
                className={i.completed ? "text-muted-foreground line-through" : ""}
              >
                {i.label}
              </Label>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={ClipboardList} title="No checklist items" />
      )}
    </section>
  );
}

function Chemistry({
  serviceId,
  orgId,
  poolId,
  date,
  canEdit,
}: {
  serviceId: string;
  orgId: string;
  poolId: string | null;
  date: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  const reading = useQuery({
    queryKey: ["service-chemistry", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_chemistry_readings")
        .select("*")
        .eq("service_record_id", serviceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const r = reading.data;
    if (!r) return;
    const next: Record<string, string> = {};
    for (const f of CHEMISTRY_FIELDS) {
      const v = (r as Record<string, unknown>)[f.key];
      next[f.key] = v === null || v === undefined ? "" : String(v);
    }
    setForm(next);
    setNotes(r.notes ?? "");
  }, [reading.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Database["public"]["Tables"]["service_chemistry_readings"]["Update"] = {
        notes: notes.trim() || null,
      };
      const numeric = payload as Record<string, number | null | string>;
      for (const f of CHEMISTRY_FIELDS) {
        const raw = form[f.key];
        numeric[f.key] = raw === undefined || raw === "" ? null : Number(raw);
      }
      if (reading.data?.id) {
        const { error } = await supabase
          .from("service_chemistry_readings")
          .update(payload)
          .eq("id", reading.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("service_chemistry_readings").insert({
          ...payload,
          organization_id: orgId,
          service_record_id: serviceId,
          pool_id: poolId,
          reading_date: date,
        });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Water chemistry saved.");
      await queryClient.invalidateQueries({ queryKey: ["service-chemistry", serviceId] });
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't save the readings.")),
  });

  return (
    <section className="panel">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold">Water chemistry</h2>
        {canEdit ? (
          <Button
            size="sm"
            variant="outline"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            Save readings
          </Button>
        ) : null}
      </header>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {CHEMISTRY_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`chem-${f.key}`} className="text-xs">
              {f.label}
              {f.unit ? ` (${f.unit})` : ""}
            </Label>
            <Input
              id={`chem-${f.key}`}
              type="number"
              inputMode="decimal"
              step="0.1"
              disabled={!canEdit}
              value={form[f.key] ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
            {f.ideal ? <p className="text-[11px] text-muted-foreground">Ideal {f.ideal}</p> : null}
          </div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <Label htmlFor="chem-notes" className="text-xs">
          Chemistry notes
        </Label>
        <Textarea
          id="chem-notes"
          rows={2}
          className="mt-1.5"
          disabled={!canEdit}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </section>
  );
}

function Chemicals({
  serviceId,
  orgId,
  poolId,
  canEdit,
}: {
  serviceId: string;
  orgId: string;
  poolId: string | null;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(COMMON_CHEMICALS[0]!);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("gallons");

  const list = useQuery({
    queryKey: ["service-chemicals", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_chemical_usage")
        .select("id, chemical_name, quantity, unit")
        .eq("service_record_id", serviceId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("service_chemical_usage").insert({
        organization_id: orgId,
        service_record_id: serviceId,
        pool_id: poolId,
        chemical_name: name,
        quantity: Number(quantity),
        unit,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setQuantity("");
      await queryClient.invalidateQueries({ queryKey: ["service-chemicals", serviceId] });
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't add that chemical.")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_chemical_usage").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["service-chemicals", serviceId] });
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't remove that entry.")),
  });

  return (
    <section className="panel">
      <header className="border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold">Chemicals added</h2>
      </header>
      {list.data?.length ? (
        <ul className="divide-y divide-border">
          {list.data.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <Beaker className="size-4 text-muted-foreground" />
              <span className="flex-1">{c.chemical_name}</span>
              <span className="num text-muted-foreground">
                {c.quantity} {CHEMICAL_UNITS[c.unit] ?? c.unit}
              </span>
              {canEdit ? (
                <button
                  type="button"
                  aria-label="Remove chemical"
                  className="text-destructive"
                  onClick={() => remove.mutate(c.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-sm text-muted-foreground">No chemicals recorded yet.</p>
      )}

      {canEdit ? (
        <form
          className="grid gap-2 border-t border-border p-4 sm:grid-cols-[2fr_1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!Number(quantity)) {
              toast.error("Enter how much was added.");
              return;
            }
            add.mutate();
          }}
        >
          <Select value={name} onValueChange={setName}>
            <SelectTrigger aria-label="Chemical">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_CHEMICALS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            step="0.1"
            min="0"
            inputMode="decimal"
            placeholder="Amount"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger aria-label="Unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CHEMICAL_UNITS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline" disabled={add.isPending}>
            <Plus className="size-4" />
          </Button>
        </form>
      ) : null}
    </section>
  );
}

function Equipment({
  serviceId,
  orgId,
  poolId,
  canEdit,
}: {
  serviceId: string;
  orgId: string;
  poolId: string | null;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState("pump");
  const [condition, setCondition] = useState("good");
  const [note, setNote] = useState("");

  const list = useQuery({
    queryKey: ["service-equipment", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_equipment_observations")
        .select("id, equipment_type, condition, notes")
        .eq("service_record_id", serviceId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("service_equipment_observations").insert({
        organization_id: orgId,
        service_record_id: serviceId,
        pool_id: poolId,
        equipment_type: type,
        condition,
        notes: note.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["service-equipment", serviceId] });
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't save that observation.")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_equipment_observations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["service-equipment", serviceId] });
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't remove that observation.")),
  });

  return (
    <section className="panel">
      <header className="border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold">Equipment observations</h2>
      </header>
      {list.data?.length ? (
        <ul className="divide-y divide-border">
          {list.data.map((o) => (
            <li key={o.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
              <Wrench className="mt-0.5 size-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium">
                  {EQUIPMENT_TYPES[o.equipment_type] ?? o.equipment_type}
                </p>
                {o.notes ? <p className="text-xs text-muted-foreground">{o.notes}</p> : null}
              </div>
              <StatusBadge
                status={
                  o.condition === "good"
                    ? "completed"
                    : o.condition === "problem"
                      ? "overdue"
                      : o.condition === "attention"
                        ? "partially_paid"
                        : "void"
                }
                label={EQUIPMENT_CONDITIONS[o.condition] ?? o.condition}
              />
              {canEdit ? (
                <button
                  type="button"
                  aria-label="Remove observation"
                  className="text-destructive"
                  onClick={() => remove.mutate(o.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-sm text-muted-foreground">
          No equipment issues logged for this visit.
        </p>
      )}

      {canEdit ? (
        <form
          className="grid gap-2 border-t border-border p-4 sm:grid-cols-[1fr_1fr_2fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <Select value={type} onValueChange={setType}>
            <SelectTrigger aria-label="Equipment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EQUIPMENT_TYPES).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger aria-label="Condition">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EQUIPMENT_CONDITIONS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="What did you notice?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={add.isPending}>
            <Plus className="size-4" />
          </Button>
        </form>
      ) : null}
    </section>
  );
}

function Notes({
  serviceId,
  internal,
  customerVisible,
  canEdit,
  onSaved,
}: {
  serviceId: string;
  internal: string | null;
  customerVisible: string | null;
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({ notes: internal ?? "", customer: customerVisible ?? "" });

  useEffect(() => {
    setForm({ notes: internal ?? "", customer: customerVisible ?? "" });
  }, [internal, customerVisible]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("service_records")
        .update({
          notes: form.notes.trim() || null,
          customer_visible_notes: form.customer.trim() || null,
        })
        .eq("id", serviceId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Notes saved.");
      await onSaved();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't save those notes.")),
  });

  return (
    <section className="panel">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold">Notes</h2>
        {canEdit ? (
          <Button
            size="sm"
            variant="outline"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            Save notes
          </Button>
        ) : null}
      </header>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="internal-notes" className="text-xs">
            Internal notes (team only)
          </Label>
          <Textarea
            id="internal-notes"
            rows={4}
            disabled={!canEdit}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="customer-notes" className="text-xs">
            Customer-visible notes
          </Label>
          <Textarea
            id="customer-notes"
            rows={4}
            disabled={!canEdit}
            value={form.customer}
            onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))}
          />
        </div>
      </div>
    </section>
  );
}

function SkipDialog({
  open,
  onOpenChange,
  serviceId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: string;
  onSaved: () => Promise<void>;
}) {
  const [reason, setReason] = useState("no_access");
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("service_records")
        .update({ status: "skipped", skip_reason: reason, skip_note: note.trim() || null })
        .eq("id", serviceId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Visit marked as skipped.");
      onOpenChange(false);
      await onSaved();
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't skip this visit.")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skip this visit</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SKIP_REASONS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skip-note">Details</Label>
            <Textarea
              id="skip-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Mark skipped
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
