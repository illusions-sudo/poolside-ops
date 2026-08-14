import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarClock,
  CreditCard,
  FileText,
  MapPin,
  ShieldCheck,
  Users,
  Waves,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AquaLedger — Pool Service Management Software" },
      {
        name: "description",
        content:
          "Manage pool service customers, properties, recurring service plans, invoicing and payments in one secure multi-company platform.",
      },
      { property: "og:title", content: "AquaLedger — Pool Service Management Software" },
      {
        property: "og:description",
        content:
          "Customers, properties, pools, service plans, automated invoicing and payment tracking for pool service companies.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Users,
    title: "Customers & contacts",
    body: "One record per customer with billing details, properties, notes and full service history.",
  },
  {
    icon: MapPin,
    title: "Properties & pools",
    body: "Track every property, gate code, access note, pool type, volume and equipment detail.",
  },
  {
    icon: CalendarClock,
    title: "Service plans & visits",
    body: "Recurring weekly, bi-weekly or monthly plans with scheduled and completed visit logs.",
  },
  {
    icon: FileText,
    title: "Automatic invoicing",
    body: "Line items, tax, discounts and totals calculated in the database — never out of sync.",
  },
  {
    icon: CreditCard,
    title: "Payments & balances",
    body: "Record payments, watch balances update instantly and see what's overdue.",
  },
  {
    icon: BarChart3,
    title: "Reports",
    body: "Revenue collected, outstanding receivables, aging and service volume at a glance.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <span className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Waves className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">AquaLedger</span>
        </span>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border bg-sidebar">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-sidebar-border px-3 py-1 text-xs font-medium text-sidebar-foreground/80">
              <ShieldCheck className="size-3.5" /> Multi-company. Data isolated by design.
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] text-sidebar-accent-foreground sm:text-5xl">
              Run your pool service business without the spreadsheets.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-sidebar-foreground/75">
              AquaLedger keeps customers, properties, pools, recurring service plans, invoices and
              payments in one place — so every route is covered and every dollar is accounted for.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Create your company account</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-sidebar-foreground/60">
              Load sample data in one click to explore before adding your own customers.
            </p>
          </div>

          <div className="panel grid grid-cols-2 gap-4 self-center p-6">
            {[
              ["Open receivables", "$4,820"],
              ["Visits this week", "37"],
              ["Active plans", "126"],
              ["Collected this month", "$18,340"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="num mt-1 font-display text-xl font-semibold">{value}</p>
              </div>
            ))}
            <p className="col-span-2 text-xs text-muted-foreground">
              Illustrative dashboard figures.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Everything a service route needs
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Built for owners who bill accurately and technicians who need today's stops, fast.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="panel p-5">
              <span className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} AquaLedger</span>
          <Link to="/auth" className="hover:text-foreground hover:underline">
            Sign in to your dashboard
          </Link>
        </div>
      </footer>
    </div>
  );
}
