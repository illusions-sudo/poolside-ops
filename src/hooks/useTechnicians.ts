import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { today } from "@/lib/format";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type TeamMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  role: AppRole | null;
  created_at: string;
};

/** Every profile in the organization, with its role. */
export function useTeam(includeInactive = true) {
  return useQuery({
    queryKey: ["team", includeInactive],
    queryFn: async (): Promise<TeamMember[]> => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, first_name, last_name, email, phone, active, created_at")
          .order("first_name", { ascending: true }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      const roleFor = new Map<string, AppRole>();
      for (const r of rolesRes.data ?? []) {
        const existing = roleFor.get(r.user_id);
        if (!existing || r.role === "owner" || (r.role === "admin" && existing === "employee")) {
          roleFor.set(r.user_id, r.role);
        }
      }
      return (profilesRes.data ?? [])
        .filter((p) => includeInactive || p.active)
        .map((p) => ({ ...p, role: roleFor.get(p.id) ?? null }));
    },
  });
}

/** Technicians available for assignment (active profiles). */
export function useTechnicianOptions(enabled = true) {
  return useQuery({
    queryKey: ["options", "technicians"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("active", true)
        .order("first_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** Today's workload per technician: open + completed stop counts. */
export function useTodayWorkload() {
  const date = today();
  return useQuery({
    queryKey: ["workload", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_records")
        .select("id, technician_id, status")
        .eq("service_date", date);
      if (error) throw error;
      const map = new Map<string, { total: number; done: number }>();
      for (const r of data ?? []) {
        const key = r.technician_id ?? "unassigned";
        const entry = map.get(key) ?? { total: 0, done: 0 };
        entry.total += 1;
        if (r.status === "completed") entry.done += 1;
        map.set(key, entry);
      }
      return map;
    },
  });
}
