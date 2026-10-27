import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { friendlyError } from "@/lib/format";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AquaLedger Pool Service Management" },
      {
        name: "description",
        content: "Sign in to manage pool service customers, service plans, invoices and payments.",
      },
      { property: "og:title", content: "Sign in — AquaLedger" },
      {
        property: "og:description",
        content: "Access your pool service company dashboard.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { session, loadingSession } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    if (!loadingSession && session) navigate({ to: "/dashboard", replace: true });
  }, [loadingSession, session, navigate]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (error) {
          toast.error(
            /invalid login/i.test(error.message)
              ? "That email and password combination is incorrect."
              : friendlyError(error, "We couldn't sign you in."),
          );
          return;
        }
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          toast.error(friendlyError(error, "We couldn't send that reset email."));
          return;
        }
        toast.success("Password reset email sent. Check your inbox.");
        setMode("signin");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Waves className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold text-sidebar-accent-foreground">
            AquaLedger
          </span>
        </div>
        <div className="max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight text-sidebar-accent-foreground">
            The operating system for pool service companies.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-sidebar-foreground/75">
            Track customers, properties and pools. Run recurring service plans, log every visit,
            invoice accurately and get paid — with your company's data fully isolated and secure.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-sidebar-foreground/70">
            <li>• Customer, property and pool records</li>
            <li>• Recurring service plans and service history</li>
            <li>• Automatic invoice calculations and payment tracking</li>
            <li>• Revenue and receivables reporting</li>
          </ul>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          © {new Date().getFullYear()} AquaLedger. Built for pool professionals.
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <span className="flex items-center gap-2 font-display text-lg font-semibold">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Waves className="size-4" />
              </span>
              AquaLedger
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "forgot" ? "Reset your password" : "Sign in"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "We'll email you a secure reset link."
              : "Welcome back. Sign in to your dashboard."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={set("email")}
                required
              />
            </div>

            {mode !== "forgot" ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setMode("forgot")}
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={set("password")}
                  required
                  minLength={8}
                />
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {mode === "forgot" ? "Send reset link" : "Sign in"}
            </Button>
          </form>

          {mode === "forgot" ? (
            <button
              className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setMode("signin")}
            >
              Back to sign in
            </button>
          ) : null}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground hover:underline">
              Back to homepage
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
