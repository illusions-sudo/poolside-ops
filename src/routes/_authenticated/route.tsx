import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", data.user.id)
      .maybeSingle();

    const hasOrg = !!profile?.organization_id;
    const onOnboarding = location.pathname.startsWith("/onboarding");
    if (!hasOrg && !onOnboarding) throw redirect({ to: "/onboarding" });
    if (hasOrg && onOnboarding) throw redirect({ to: "/dashboard" });

    return { user: data.user };
  },
  component: () => <Outlet />,
});
