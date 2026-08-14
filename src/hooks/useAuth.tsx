import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  roles: AppRole[];
  isAdmin: boolean;
  role: AppRole | null;
  loadingSession: boolean;
  loadingAccount: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoadingSession(false);
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event === "SIGNED_OUT") {
        queryClient.clear();
      } else {
        queryClient.invalidateQueries();
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient, router]);

  const userId = session?.user.id ?? null;

  const account = useQuery({
    queryKey: ["account", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      if (profileRes.error) throw profileRes.error;
      const profile = profileRes.data ?? null;
      let organization: Organization | null = null;
      if (profile?.organization_id) {
        const orgRes = await supabase
          .from("organizations")
          .select("*")
          .eq("id", profile.organization_id)
          .maybeSingle();
        if (orgRes.error) throw orgRes.error;
        organization = orgRes.data ?? null;
      }
      const roles = (rolesRes.data ?? []).map((r) => r.role);
      return { profile, organization, roles };
    },
  });

  const roles = account.data?.roles ?? [];

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile: account.data?.profile ?? null,
    organization: account.data?.organization ?? null,
    roles,
    role: roles.includes("owner") ? "owner" : (roles[0] ?? null),
    isAdmin: roles.includes("owner") || roles.includes("admin"),
    loadingSession,
    loadingAccount: !!userId && account.isLoading,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    signOut: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      window.location.assign("/auth");
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
