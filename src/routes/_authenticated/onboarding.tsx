import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Waves } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your company — AquaLedger" },
      {
        name: "description",
        content: "Create your pool service company workspace to start managing customers.",
      },
      { property: "og:title", content: "Set up your company — AquaLedger" },
      { property: "og:description", content: "Create your pool service company workspace." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { user, refresh, signOut } = useAuth();
  const navigate = useNavigate();
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    name: meta["company_name"] ?? "",
    firstName: meta["first_name"] ?? "",
    lastName: meta["last_name"] ?? "",
    phone: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Please enter your company name.");
      return;
    }
    setPending(true);
    const { error } = await supabase.rpc("create_organization", {
      p_name: form.name.trim(),
      p_first_name: form.firstName.trim(),
      p_last_name: form.lastName.trim(),
      p_phone: form.phone.trim(),
    });
    setPending(false);
    if (error) {
      toast.error(friendlyError(error, "We couldn't create your company workspace."));
      return;
    }
    await refresh();
    toast.success("Company created. Welcome aboard.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <span className="mb-6 flex items-center gap-2 font-display text-lg font-semibold">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Waves className="size-4" />
          </span>
          AquaLedger
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Set up your company</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This creates your private workspace. Only people you invite can see its data.
        </p>

        <form onSubmit={onSubmit} className="panel mt-6 space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Company name</Label>
            <Input
              id="name"
              placeholder="e.g. Mountain View Pool Service"
              value={form.name}
              onChange={set("name")}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Your first name</Label>
              <Input id="firstName" value={form.firstName} onChange={set("firstName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Your last name</Label>
              <Input id="lastName" value={form.lastName} onChange={set("lastName")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" value={form.phone} onChange={set("phone")} />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Create company workspace
          </Button>
        </form>

        <button
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
