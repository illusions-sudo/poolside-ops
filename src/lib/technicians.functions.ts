import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  phone: z.string().trim().optional().nullable(),
  role: z.enum(["admin", "employee"]),
});

/**
 * Creates a technician/employee login inside the caller's organization.
 * The caller must be an owner/admin of that organization.
 */
export const createTechnician = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: me, error: meErr } = await context.supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (meErr) throw new Error(meErr.message);
    const orgId = me?.organization_id;
    if (!orgId) throw new Error("Your company workspace is not set up yet.");

    const { data: roles, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleErr) throw new Error(roleErr.message);
    const isAdmin = (roles ?? []).some((r) => r.role === "owner" || r.role === "admin");
    if (!isAdmin) throw new Error("Only owners and admins can add team members.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { first_name: data.first_name, last_name: data.last_name },
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "We couldn't create that login.");
    }
    const newUserId = created.data.user.id;

    const profileRes = await supabaseAdmin.from("profiles").upsert({
      id: newUserId,
      organization_id: orgId,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone || null,
      active: true,
    });
    if (profileRes.error) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(profileRes.error.message);
    }

    const roleRes = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, organization_id: orgId, role: data.role });
    if (roleRes.error) throw new Error(roleRes.error.message);

    return { id: newUserId };
  });

/** Resets a team member's password. Owner/admin only, same organization. */
export const resetTechnicianPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(8) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", context.userId)
      .maybeSingle();
    const orgId = me?.organization_id;
    if (!orgId) throw new Error("Your company workspace is not set up yet.");

    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "owner" || r.role === "admin");
    if (!isAdmin) throw new Error("Only owners and admins can reset passwords.");

    const { data: target } = await context.supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("id", data.user_id)
      .maybeSingle();
    if (!target || target.organization_id !== orgId) {
      throw new Error("That team member isn't part of your company.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });
