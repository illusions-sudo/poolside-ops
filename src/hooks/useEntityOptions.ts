import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export function useCustomerOptions(enabled = true) {
  return useQuery({
    queryKey: ["options", "customers"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, company_name")
        .eq("active", true)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function usePropertyOptions(customerId: string | undefined) {
  return useQuery({
    queryKey: ["options", "properties", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, property_name, address, city")
        .eq("customer_id", customerId!)
        .eq("active", true)
        .order("address", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function usePoolOptions(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["options", "pools", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pools")
        .select("id, pool_name, pool_type")
        .eq("property_id", propertyId!)
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function usePlanOptions(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["options", "plans", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_plans")
        .select("id, service_name, price, frequency, pool_id")
        .eq("property_id", propertyId!)
        .order("service_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useTeamOptions(enabled = true) {
  return useQuery({
    queryKey: ["options", "team"],
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

export function propertyLabel(p: {
  property_name?: string | null;
  address?: string | null;
  city?: string | null;
}): string {
  const base = p.property_name?.trim() || p.address?.trim() || "Property";
  if (p.property_name && p.address) return `${p.property_name} — ${p.address}`;
  return p.city ? `${base}, ${p.city}` : base;
}

export function poolLabel(p: { pool_name?: string | null; pool_type?: string | null }): string {
  return (
    p.pool_name?.trim() ||
    (p.pool_type ? p.pool_type.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "Pool")
  );
}
