import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Route as RouteIcon,
  FileText,
  Gauge,
  Home,
  LogOut,
  MapPin,
  Menu,
  Search,
  Settings,
  User,
  UserCog,
  Users,
  Waves,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { GlobalSearch } from "@/components/shell/global-search";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/my-day", label: "My Day", icon: ClipboardCheck },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/routes", label: "Routes", icon: RouteIcon },
  { to: "/technicians", label: "Technicians", icon: UserCog },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/properties", label: "Properties", icon: MapPin },
  { to: "/service-plans", label: "Service Plans", icon: Gauge },
  { to: "/service-history", label: "Service History", icon: CalendarClock },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const TECH_NAV = [
  { to: "/my-day", label: "My Day", icon: ClipboardCheck },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/service-history", label: "Service History", icon: CalendarClock },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

type NavItem = { to: string; label: string; icon: typeof Home };

function NavLinks({ items, onNavigate }: { items: readonly NavItem[]; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-2">
      {items.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to as "/dashboard"}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-4">
      <span className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
        <Waves className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-sm font-semibold text-sidebar-accent-foreground">
          {name}
        </span>
        <span className="block text-[11px] uppercase tracking-wide text-sidebar-foreground/60">
          Pool Service OS
        </span>
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, organization, role, isAdmin, signOut } = useAuth();
  const nav: readonly NavItem[] = isAdmin ? ADMIN_NAV : TECH_NAV;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const orgName = organization?.business_name || organization?.name || "Your company";

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar lg:flex">
        <Brand name={orgName} />
        <NavLinks items={nav} />
        <div className="px-4 pb-4 text-[11px] text-sidebar-foreground/50">
          {profile?.email ?? ""}
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur sm:px-6 no-print">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-none bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Brand name={orgName} />
              <NavLinks items={nav} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/40 sm:max-w-sm"
          >
            <Search className="size-4" />
            Search customers, invoices, properties…
          </button>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {initials(profile?.first_name, profile?.last_name, "U")}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm font-medium leading-4">
                      {[profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
                        "Account"}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {role ? ROLE_LABELS[role] : ""}
                    </span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {profile?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" search={{ tab: "account" }}>
                    <User className="mr-2 size-4" /> Profile &amp; password
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void signOut()}>
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 pb-24 sm:px-6 lg:py-8 lg:pb-8">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card lg:hidden no-print">
          {nav.slice(0, 4).map((item) => (
            <Link
              key={item.to}
              to={item.to as "/dashboard"}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground [&.active]:text-primary"
              activeProps={{ className: "active" }}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
