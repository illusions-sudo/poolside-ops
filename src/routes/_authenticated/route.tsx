import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { isNetworkError } from "@/lib/offline-queue";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // With no signal, trust the sign-in saved on this device so field screens still open.
    if (!navigator.onLine) {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw redirect({ to: "/auth" });
      return { user: data.session.user };
    }

    const { data, error } = await supabase.auth.getUser();
    if (error && isNetworkError(error)) {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) throw redirect({ to: "/auth" });
      return { user: s.session.user };
    }
    if (error || !data.user) throw redirect({ to: "/auth" });

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError && isNetworkError(profileError)) return { user: data.user };

    const hasOrg = !!profile?.organization_id;
    const onOnboarding = location.pathname.startsWith("/onboarding");
    if (!hasOrg && !onOnboarding) throw redirect({ to: "/onboarding" });
    if (hasOrg && onOnboarding) throw redirect({ to: "/dashboard" });

    return { user: data.user };
  },
  component: () => <Outlet />,
});
